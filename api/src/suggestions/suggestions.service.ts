import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LIMIT = 8;

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuggestions(userId: number | null, excludeProductId?: number): Promise<unknown[]> {
    if (userId) {
      return this.personalSuggestions(userId, excludeProductId);
    }
    return this.globalBestsellers(excludeProductId);
  }

  private async personalSuggestions(userId: number, excludeProductId?: number) {
    // Category IDs the user has ordered or has in cart
    const [orderCategories, cartCategories] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { order: { userId } },
        select: { product: { select: { categoryId: true } } },
        distinct: ['productId'],
      }).then(rows => rows.map(r => r.product.categoryId)),

      this.prisma.cartItem.findMany({
        where: { cart: { userId } },
        select: { product: { select: { categoryId: true } } },
      }).then(rows => rows.map(r => r.product.categoryId)),
    ]);

    const affinityCategoryIds = [...new Set([...orderCategories, ...cartCategories])];

    // Product IDs the user already owns or has in cart
    const [ownedIds, cartIds] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { order: { userId } },
        select: { productId: true },
        distinct: ['productId'],
      }).then(rows => rows.map(r => r.productId)),

      this.prisma.cartItem.findMany({
        where: { cart: { userId } },
        select: { productId: true },
      }).then(rows => rows.map(r => r.productId)),
    ]);

    const excludeIds = [...new Set([...ownedIds, ...cartIds, ...(excludeProductId ? [excludeProductId] : [])])];

    if (affinityCategoryIds.length > 0) {
      const rows = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT p.id
        FROM "Product" p
        LEFT JOIN (
          SELECT oi."productId", SUM(oi.quantity) AS sold
          FROM "OrderItem" oi
          GROUP BY oi."productId"
        ) sales ON sales."productId" = p.id
        WHERE p."categoryId" = ANY(${affinityCategoryIds}::int[])
          AND p.stock > 0
          AND p.id <> ALL(${excludeIds.length > 0 ? excludeIds : [0]}::int[])
        ORDER BY COALESCE(sales.sold, 0) DESC
        LIMIT ${LIMIT}
      `;

      if (rows.length > 0) {
        return this.prisma.product.findMany({
          where: { id: { in: rows.map(r => r.id) } },
          include: { category: { select: { id: true, name: true, slug: true } } },
        });
      }
    }

    // Fall back to global bestsellers if no affinity data
    return this.globalBestsellers(excludeProductId);
  }

  private async globalBestsellers(excludeProductId?: number) {
    const excludeIds = excludeProductId ? [excludeProductId] : [0];

    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id
      FROM "Product" p
      LEFT JOIN (
        SELECT oi."productId", SUM(oi.quantity) AS sold
        FROM "OrderItem" oi
        GROUP BY oi."productId"
      ) sales ON sales."productId" = p.id
      WHERE p.stock > 0
        AND p.id <> ALL(${excludeIds}::int[])
      ORDER BY COALESCE(sales.sold, 0) DESC, p."createdAt" DESC
      LIMIT ${LIMIT}
    `;

    return this.prisma.product.findMany({
      where: { id: { in: rows.map(r => r.id) } },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }
}
