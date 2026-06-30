import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException, ConflictException,
  UnprocessableEntityException, ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService, VALID_TRANSITIONS } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

// Stub out Stripe so no real HTTP calls are made
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create:   jest.fn(),
        retrieve: jest.fn(),
      },
    },
  }));
});

const PRODUCT = { id: 1, name: 'Widget', priceCents: 2000, stock: 5, imageUrl: '' };
const CART_WITH_ITEMS = {
  id: 1,
  userId: 42,
  items: [{ id: 1, cartId: 1, productId: 1, quantity: 2, product: PRODUCT }],
};
const EMPTY_CART = { id: 1, userId: 42, items: [] };

const ORDER = {
  id: 100,
  userId: 42,
  status: OrderStatus.PENDING,
  totalCents: 4599, // 2×2000 + 599 shipping
  stripeSessionId: null,
  createdAt: new Date(),
  items: [{ id: 1, orderId: 100, productId: 1, unitPriceCents: 2000, quantity: 2, product: PRODUCT }],
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    cart:     { findUnique: jest.Mock };
    product:  { findUnique: jest.Mock; update: jest.Mock };
    order:    { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock; groupBy: jest.Mock };
    cartItem: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  // tx is the mock "transactional client" passed to the $transaction callback
  let tx: typeof prisma;

  beforeEach(async () => {
    tx = {
      cart:     { findUnique: jest.fn() },
      product:  { findUnique: jest.fn(), update: jest.fn() },
      order:    { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      cartItem: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };

    prisma = {
      cart:     { findUnique: jest.fn() },
      product:  { findUnique: jest.fn(), update: jest.fn() },
      order:    { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      cartItem: { deleteMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── checkout ────────────────────────────────────────────────────────────────

  describe('checkout', () => {
    it('creates an order with snapshotted unit prices and decrements stock', async () => {
      tx.cart.findUnique.mockResolvedValue(CART_WITH_ITEMS);
      tx.product.findUnique.mockResolvedValue(PRODUCT);
      tx.product.update.mockResolvedValue({});
      tx.order.create.mockResolvedValue(ORDER);
      tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.checkout(42);

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 42,
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({ productId: 1, unitPriceCents: 2000, quantity: 2 }),
              ]),
            },
          }),
        }),
      );
      expect(tx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { stock: { decrement: 2 } } }),
      );
      expect(result).toEqual(ORDER);
    });

    it('adds $5.99 shipping when subtotal is below $75 threshold', async () => {
      // priceCents=2000, qty=2 → subtotal=4000 cents ($40), below $75
      tx.cart.findUnique.mockResolvedValue(CART_WITH_ITEMS);
      tx.product.findUnique.mockResolvedValue(PRODUCT);
      tx.product.update.mockResolvedValue({});
      tx.order.create.mockResolvedValue(ORDER);
      tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.checkout(42);

      const createCall = tx.order.create.mock.calls[0][0];
      expect(createCall.data.totalCents).toBe(4000 + 599);
    });

    it('applies free shipping when subtotal is at or above $75 threshold', async () => {
      const expensiveProduct = { ...PRODUCT, priceCents: 4000 }; // 2×4000 = 8000 cents ≥ 7500
      const cartWithExpensive = {
        ...CART_WITH_ITEMS,
        items: [{ ...CART_WITH_ITEMS.items[0], product: expensiveProduct }],
      };

      tx.cart.findUnique.mockResolvedValue(cartWithExpensive);
      tx.product.findUnique.mockResolvedValue(expensiveProduct);
      tx.product.update.mockResolvedValue({});
      tx.order.create.mockResolvedValue({ ...ORDER, totalCents: 8000 });
      tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.checkout(42);

      const createCall = tx.order.create.mock.calls[0][0];
      expect(createCall.data.totalCents).toBe(8000); // no shipping added
    });

    it('throws ConflictException when the cart is empty', async () => {
      tx.cart.findUnique.mockResolvedValue(EMPTY_CART);

      await expect(service.checkout(42)).rejects.toThrow(ConflictException);
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the cart does not exist', async () => {
      tx.cart.findUnique.mockResolvedValue(null);

      await expect(service.checkout(42)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException (409) with stock details when a product has insufficient stock', async () => {
      const lowStockProduct = { ...PRODUCT, stock: 1 }; // cart wants 2
      const cart = {
        ...CART_WITH_ITEMS,
        items: [{ ...CART_WITH_ITEMS.items[0], product: lowStockProduct }],
      };

      tx.cart.findUnique.mockResolvedValue(cart);
      tx.product.findUnique.mockResolvedValue(lowStockProduct);

      const err = await service.checkout(42).catch(e => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('clears the cart after creating the order', async () => {
      tx.cart.findUnique.mockResolvedValue(CART_WITH_ITEMS);
      tx.product.findUnique.mockResolvedValue(PRODUCT);
      tx.product.update.mockResolvedValue({});
      tx.order.create.mockResolvedValue(ORDER);
      tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.checkout(42);

      expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 1 } });
    });

    it('uses price from the product row (not the cart), providing a price snapshot', async () => {
      // Even if cart item somehow carries a stale price, the service re-reads from the product row
      tx.cart.findUnique.mockResolvedValue(CART_WITH_ITEMS);
      tx.product.findUnique.mockResolvedValue({ ...PRODUCT, priceCents: 3000 }); // price changed
      tx.product.update.mockResolvedValue({});
      tx.order.create.mockResolvedValue(ORDER);
      tx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.checkout(42);

      const createCall = tx.order.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].unitPriceCents).toBe(3000);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns orders for the given user, newest first', async () => {
      prisma.order.findMany.mockResolvedValue([ORDER]);

      const result = await service.findAll(42);

      expect(result).toEqual([ORDER]);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 }, orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ─── findAllAdmin ─────────────────────────────────────────────────────────────

  describe('findAllAdmin', () => {
    it('returns paginated orders with no status filter by default', async () => {
      prisma.order.findMany.mockResolvedValue([ORDER]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAllAdmin({});

      expect(result).toEqual({ items: [ORDER], total: 1, page: 1, pageSize: 20 });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 20 }),
      );
    });

    it('applies status filter when provided', async () => {
      prisma.order.findMany.mockResolvedValue([ORDER]);
      prisma.order.count.mockResolvedValue(1);

      await service.findAllAdmin({ status: OrderStatus.PENDING });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: OrderStatus.PENDING } }),
      );
    });
  });

  // ─── findOneAdmin ─────────────────────────────────────────────────────────────

  describe('findOneAdmin', () => {
    it('returns the order when it exists', async () => {
      prisma.order.findUnique.mockResolvedValue(ORDER);

      const result = await service.findOneAdmin(100);

      expect(result).toEqual(ORDER);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOneAdmin(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the order when it belongs to the requesting user', async () => {
      prisma.order.findUnique.mockResolvedValue(ORDER);

      const result = await service.findOne(42, 100);

      expect(result).toEqual(ORDER);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne(42, 999)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the order belongs to a different user', async () => {
      const otherUserOrder = { ...ORDER, userId: 99 };
      prisma.order.findUnique.mockResolvedValue(otherUserOrder);

      await expect(service.findOne(42, 100)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── updateStatus (state machine) ────────────────────────────────────────────

  describe('updateStatus', () => {
    it.each([
      [OrderStatus.PENDING,    OrderStatus.PROCESSING],
      [OrderStatus.PENDING,    OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING, OrderStatus.SHIPPED],
      [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED,    OrderStatus.DELIVERED],
    ])('allows transition %s → %s', async (from, to) => {
      prisma.order.findUnique.mockResolvedValue({ ...ORDER, status: from });
      prisma.order.update.mockResolvedValue({ ...ORDER, status: to });

      const result = await service.updateStatus(100, to);

      expect(result.status).toBe(to);
    });

    it.each([
      [OrderStatus.PENDING,    OrderStatus.SHIPPED],
      [OrderStatus.PENDING,    OrderStatus.DELIVERED],
      [OrderStatus.PROCESSING, OrderStatus.PENDING],
      [OrderStatus.PROCESSING, OrderStatus.DELIVERED],
      [OrderStatus.SHIPPED,    OrderStatus.PENDING],
      [OrderStatus.SHIPPED,    OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED,  OrderStatus.PROCESSING],
      [OrderStatus.CANCELLED,  OrderStatus.PENDING],
    ])('rejects invalid transition %s → %s with 422', async (from, to) => {
      prisma.order.findUnique.mockResolvedValue({ ...ORDER, status: from });

      await expect(service.updateStatus(100, to)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus(999, OrderStatus.PROCESSING)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── VALID_TRANSITIONS export ────────────────────────────────────────────────

  describe('VALID_TRANSITIONS', () => {
    it('has no transitions from DELIVERED (terminal state)', () => {
      expect(VALID_TRANSITIONS[OrderStatus.DELIVERED]).toHaveLength(0);
    });

    it('has no transitions from CANCELLED (terminal state)', () => {
      expect(VALID_TRANSITIONS[OrderStatus.CANCELLED]).toHaveLength(0);
    });
  });
});
