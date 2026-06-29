import {
  Injectable, NotFoundException,
  ConflictException, UnprocessableEntityException, ForbiddenException,
  BadGatewayException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';

// PENDING → PROCESSING → SHIPPED → DELIVERED.  PENDING|PROCESSING → CANCELLED.
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED',    'CANCELLED'],
  SHIPPED:    ['DELIVERED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  },
};

// $5.99 flat shipping, free above $75
const SHIPPING_CENTS      = 599;
const FREE_SHIP_THRESHOLD = 7500;

@Injectable()
export class OrdersService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  async checkout(userId: number) {
    // Entire checkout runs in one transaction — cart quantities and product stock
    // are both read inside to avoid TOCTOU gaps under concurrent requests.
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new ConflictException('Cart is empty');
      }

      const lines: { productId: number; quantity: number; unitPriceCents: number }[] = [];
      const stockErrors: { productId: number; available: number; requested: number }[] = [];

      for (const item of cart.items) {
        // Re-read product inside the transaction for the authoritative stock/price
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new NotFoundException(`Product #${item.productId} not found`);

        if (product.stock < item.quantity) {
          stockErrors.push({
            productId: product.id,
            available: product.stock,
            requested: item.quantity,
          });
          continue;
        }

        lines.push({
          productId:      product.id,
          quantity:       item.quantity,
          unitPriceCents: product.priceCents, // snapshot at purchase time — never from live price
        });
      }

      if (stockErrors.length > 0) {
        throw new ConflictException({ message: 'Insufficient stock', errors: stockErrors });
      }

      const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
      const shippingCents = subtotalCents >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;
      const totalCents    = subtotalCents + shippingCents;

      // Decrement stock
      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data:  { stock: { decrement: line.quantity } },
        });
      }

      // Create order + order items
      const order = await tx.order.create({
        data: {
          userId,
          totalCents,
          items: { create: lines },
        },
        include: ORDER_INCLUDE,
      });

      // Clear cart atomically with order creation
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async findAll(userId: number) {
    return this.prisma.order.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async findAllAdmin(q: QueryAdminOrdersDto) {
    const page     = q.page     ?? 1;
    const pageSize = q.pageSize ?? 20;
    const skip     = (page - 1) * pageSize;
    const where    = q.status ? { status: q.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          ...ORDER_INCLUDE,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneAdmin(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where:   { id: orderId },
      include: {
        ...ORDER_INCLUDE,
        user: { select: { id: true, email: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    return order;
  }

  async findOne(userId: number, orderId: number) {
    const order = await this.prisma.order.findUnique({
      where:   { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);
    if (order.userId !== userId) throw new ForbiddenException();
    return order;
  }

  async createStripeSession(userId: number) {
    // Load cart to build line items — no stock change yet (avoids orphan orders on abandonment)
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new ConflictException('Cart is empty');
    }

    // Validate stock without touching it
    const stockErrors: { productId: number; available: number; requested: number }[] = [];
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        stockErrors.push({ productId: item.productId, available: item.product.stock, requested: item.quantity });
      }
    }
    if (stockErrors.length > 0) {
      throw new ConflictException({ message: 'Insufficient stock', errors: stockErrors });
    }

    const subtotal = cart.items.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);
    const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;

    const webOrigin = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = cart.items.map(item => ({
      price_data: {
        currency: 'usd',
        unit_amount: item.product.priceCents,
        product_data: {
          name: item.product.name,
          ...(item.product.imageUrl ? { images: [item.product.imageUrl] } : {}),
        },
      },
      quantity: item.quantity,
    }));

    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: shipping,
          product_data: { name: 'Shipping' },
        },
        quantity: 1,
      });
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${webOrigin}/checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${webOrigin}/checkout?canceled=1`,
        metadata:    { userId: String(userId) },
      });
      return { url: session.url };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stripe error';
      throw new BadGatewayException(`Stripe session creation failed: ${msg}`);
    }
  }

  async confirmStripeCheckout(userId: number, sessionId: string) {
    // Idempotent: if order already exists for this session, return it
    const existing = await this.prisma.order.findUnique({
      where:   { stripeSessionId: sessionId },
      include: ORDER_INCLUDE,
    });
    if (existing) return existing;

    // Retrieve session from Stripe to verify payment
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stripe error';
      throw new BadGatewayException(`Stripe session retrieval failed: ${msg}`);
    }

    if (session.payment_status !== 'paid') {
      throw new ConflictException(`Payment not completed (status: ${session.payment_status})`);
    }

    // Run the same transactional checkout, including stripeSessionId
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new ConflictException('Cart is empty');
      }

      const lines: { productId: number; quantity: number; unitPriceCents: number }[] = [];
      const stockErrors: { productId: number; available: number; requested: number }[] = [];

      for (const item of cart.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new NotFoundException(`Product #${item.productId} not found`);
        if (product.stock < item.quantity) {
          stockErrors.push({ productId: product.id, available: product.stock, requested: item.quantity });
          continue;
        }
        lines.push({ productId: product.id, quantity: item.quantity, unitPriceCents: product.priceCents });
      }

      if (stockErrors.length > 0) {
        throw new ConflictException({ message: 'Insufficient stock', errors: stockErrors });
      }

      const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
      const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;
      const total    = subtotal + shipping;

      for (const line of lines) {
        await tx.product.update({ where: { id: line.productId }, data: { stock: { decrement: line.quantity } } });
      }

      const order = await tx.order.create({
        data: {
          userId,
          totalCents:      total,
          stripeSessionId: sessionId,
          items:           { create: lines },
        },
        include: ORDER_INCLUDE,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async updateStatus(orderId: number, newStatus: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order #${orderId} not found`);

    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Cannot transition from ${order.status} to ${newStatus}`,
      );
    }

    return this.prisma.order.update({
      where:   { id: orderId },
      data:    { status: newStatus },
      include: ORDER_INCLUDE,
    });
  }
}
