import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TopProduct {
  id:         number;
  name:       string;
  imageUrl:   string;
  unitsSold:  number;
  salesCents: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    // Run all aggregates in parallel
    const [
      salesAgg,
      statusCounts,
      topRows,
    ] = await Promise.all([
      // Total revenue + order counts by status group
      this.prisma.$queryRaw<{ status: string; cnt: bigint; total_cents: bigint }[]>`
        SELECT status::text, COUNT(*)::bigint AS cnt, COALESCE(SUM("totalCents"),0)::bigint AS total_cents
        FROM "Order"
        GROUP BY status
      `,

      // Status counts for the status breakdown
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Top 10 products by units sold (all time, including CANCELLED orders for simplicity)
      this.prisma.$queryRaw<{ id: number; name: string; imageUrl: string; units_sold: bigint; sales_cents: bigint }[]>`
        SELECT
          p.id,
          p.name,
          p."imageUrl",
          COALESCE(SUM(oi.quantity), 0)::bigint AS units_sold,
          COALESCE(SUM(oi.quantity * oi."unitPriceCents"), 0)::bigint AS sales_cents
        FROM "Product" p
        LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
        GROUP BY p.id
        ORDER BY units_sold DESC, p."createdAt" DESC
        LIMIT 10
      `,
    ]);

    // Aggregate sales excluding CANCELLED
    let totalSalesCents = 0;
    let ordersCount     = 0;
    let deliveredCents  = 0;
    let deliveredCount  = 0;
    let attentionCount  = 0;

    for (const row of salesAgg) {
      const cnt   = Number(row.cnt);
      const cents = Number(row.total_cents);
      if (row.status !== 'CANCELLED') {
        totalSalesCents += cents;
        ordersCount     += cnt;
      }
      if (row.status === 'DELIVERED') {
        deliveredCents += cents;
        deliveredCount += cnt;
      }
      if (row.status === 'PENDING' || row.status === 'PROCESSING') {
        attentionCount += cnt;
      }
    }

    const aovCents = deliveredCount > 0 ? Math.round(deliveredCents / deliveredCount) : 0;

    const statusCountsMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusCountsMap[row.status] = row._count.id;
    }

    const topProducts: TopProduct[] = topRows.map(r => ({
      id:         r.id,
      name:       r.name,
      imageUrl:   r.imageUrl,
      unitsSold:  Number(r.units_sold),
      salesCents: Number(r.sales_cents),
    }));

    return {
      totalSalesCents,
      ordersCount,
      aovCents,
      attentionCount,
      statusCounts: statusCountsMap,
      topProducts,
    };
  }
}
