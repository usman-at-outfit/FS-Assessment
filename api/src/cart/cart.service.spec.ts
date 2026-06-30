import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const PRODUCT = { id: 10, name: 'Widget', priceCents: 999, stock: 5, imageUrl: '' };
const CART     = { id: 1, userId: 42 };
const CART_ITEM = { id: 1, cartId: 1, productId: 10, quantity: 2 };
const FULL_CART = { ...CART, items: [{ ...CART_ITEM, product: { ...PRODUCT, category: { id: 1, name: 'G', slug: 'g' } } }] };

describe('CartService', () => {
  let service: CartService;
  let prisma: {
    product:  { findUnique: jest.Mock };
    cart:     { findUnique: jest.Mock; upsert: jest.Mock };
    cartItem: { upsert: jest.Mock; deleteMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      product:  { findUnique: jest.fn() },
      cart:     { findUnique: jest.fn(), upsert: jest.fn() },
      cartItem: { upsert: jest.fn(), deleteMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getCart ─────────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('returns the cart with items for a user who has one', async () => {
      prisma.cart.findUnique.mockResolvedValue(FULL_CART);

      const result = await service.getCart(42);

      expect(result).toEqual(FULL_CART);
      expect(prisma.cart.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 } }),
      );
    });

    it('returns null when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      const result = await service.getCart(42);

      expect(result).toBeNull();
    });
  });

  // ─── upsertItem ──────────────────────────────────────────────────────────────

  describe('upsertItem', () => {
    it('creates a cart if one does not exist, then upserts the line item', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.cart.upsert.mockResolvedValue(CART);
      prisma.cartItem.upsert.mockResolvedValue(CART_ITEM);
      prisma.cart.findUnique.mockResolvedValue(FULL_CART);

      const result = await service.upsertItem(42, { productId: 10, quantity: 2 });

      expect(prisma.cart.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 42 }, create: { userId: 42 } }),
      );
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { cartId_productId: { cartId: 1, productId: 10 } },
          create: { cartId: 1, productId: 10, quantity: 2 },
          update: { quantity: 2 },
        }),
      );
      expect(result).toEqual(FULL_CART);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.upsertItem(42, { productId: 999, quantity: 1 })).rejects.toThrow(NotFoundException);
      expect(prisma.cart.upsert).not.toHaveBeenCalled();
    });

    it('updates an existing cart item quantity (upsert update path)', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.cart.upsert.mockResolvedValue(CART);
      prisma.cartItem.upsert.mockResolvedValue({ ...CART_ITEM, quantity: 5 });
      prisma.cart.findUnique.mockResolvedValue(FULL_CART);

      await service.upsertItem(42, { productId: 10, quantity: 5 });

      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 5 } }),
      );
    });
  });

  // ─── removeItem ──────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('deletes the specific cart item when the cart exists', async () => {
      prisma.cart.findUnique.mockResolvedValue(CART);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeItem(42, 10);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 1, productId: 10 },
      });
    });

    it('does nothing (no throw) when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.removeItem(42, 10)).resolves.toBeUndefined();
      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ─── clearCart ───────────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('deletes all items from the cart when it exists', async () => {
      prisma.cart.findUnique.mockResolvedValue(CART);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      await service.clearCart(42);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 1 } });
    });

    it('does nothing (no throw) when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.clearCart(42)).resolves.toBeUndefined();
      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });
});
