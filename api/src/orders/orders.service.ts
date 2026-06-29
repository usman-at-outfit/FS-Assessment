import {
  Injectable, NotFoundException,
  ConflictException, UnprocessableEntityException, ForbiddenException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

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
