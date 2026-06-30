import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    order:     { groupBy: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      order:     { groupBy: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  // Helper to set up the three parallel queries inside getStats
  function setupStats({
    salesAgg  = [] as { status: string; cnt: bigint; total_cents: bigint }[],
    groupBy   = [] as { status: string; _count: { id: number } }[],
    topRows   = [] as { id: number; name: string; imageUrl: string; units_sold: bigint; sales_cents: bigint }[],
  } = {}) {
    prisma.$queryRaw
      .mockResolvedValueOnce(salesAgg)  // first call: sales aggregate
      .mockResolvedValueOnce(topRows);  // second call: top products
    prisma.order.groupBy.mockResolvedValue(groupBy);
  }

  // ─── getStats ────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns zeroes when there are no orders', async () => {
      setupStats();

      const result = await service.getStats();

      expect(result).toMatchObject({
        totalSalesCents: 0,
        ordersCount:     0,
        aovCents:        0,
        attentionCount:  0,
        statusCounts:    {},
        topProducts:     [],
      });
    });

    it('excludes CANCELLED orders from totalSalesCents and ordersCount', async () => {
      setupStats({
        salesAgg: [
          { status: 'DELIVERED',  cnt: BigInt(2), total_cents: BigInt(10000) },
          { status: 'CANCELLED',  cnt: BigInt(5), total_cents: BigInt(3000)  },
        ],
      });

      const result = await service.getStats();

      expect(result.totalSalesCents).toBe(10000); // CANCELLED excluded
      expect(result.ordersCount).toBe(2);          // only DELIVERED counted
    });

    it('calculates AOV only from DELIVERED orders', async () => {
      setupStats({
        salesAgg: [
          { status: 'DELIVERED',   cnt: BigInt(4), total_cents: BigInt(20000) },
          { status: 'PROCESSING',  cnt: BigInt(1), total_cents: BigInt(5000)  },
        ],
      });

      const result = await service.getStats();

      // 20000 / 4 = 5000
      expect(result.aovCents).toBe(5000);
    });

    it('returns aovCents=0 when there are no DELIVERED orders', async () => {
      setupStats({
        salesAgg: [
          { status: 'PENDING', cnt: BigInt(3), total_cents: BigInt(9000) },
        ],
      });

      const result = await service.getStats();

      expect(result.aovCents).toBe(0);
    });

    it('counts attentionCount from PENDING and PROCESSING orders only', async () => {
      setupStats({
        salesAgg: [
          { status: 'PENDING',    cnt: BigInt(2), total_cents: BigInt(0) },
          { status: 'PROCESSING', cnt: BigInt(3), total_cents: BigInt(0) },
          { status: 'SHIPPED',    cnt: BigInt(1), total_cents: BigInt(0) },
          { status: 'DELIVERED',  cnt: BigInt(4), total_cents: BigInt(0) },
        ],
      });

      const result = await service.getStats();

      expect(result.attentionCount).toBe(5); // 2 + 3
    });

    it('populates statusCounts map from the groupBy result', async () => {
      setupStats({
        groupBy: [
          { status: 'PENDING',   _count: { id: 2 } },
          { status: 'DELIVERED', _count: { id: 7 } },
        ],
      });

      const result = await service.getStats();

      expect(result.statusCounts).toEqual({ PENDING: 2, DELIVERED: 7 });
    });

    it('maps topProducts with numeric values (bigint converted to number)', async () => {
      setupStats({
        topRows: [
          {
            id:          1,
            name:        'Widget',
            imageUrl:    'http://img.jpg',
            units_sold:  BigInt(42),
            sales_cents: BigInt(84000),
          },
        ],
      });

      const result = await service.getStats();

      expect(result.topProducts).toEqual([
        { id: 1, name: 'Widget', imageUrl: 'http://img.jpg', unitsSold: 42, salesCents: 84000 },
      ]);
      // Ensure they are plain numbers, not BigInt
      expect(typeof result.topProducts[0].unitsSold).toBe('number');
      expect(typeof result.topProducts[0].salesCents).toBe('number');
    });

    it('runs all three aggregation queries in parallel', async () => {
      setupStats();

      await service.getStats();

      // All three data sources should have been called exactly once
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.order.groupBy).toHaveBeenCalledTimes(1);
    });

    it('includes all non-CANCELLED statuses in totalSalesCents', async () => {
      setupStats({
        salesAgg: [
          { status: 'PENDING',    cnt: BigInt(1), total_cents: BigInt(1000) },
          { status: 'PROCESSING', cnt: BigInt(1), total_cents: BigInt(2000) },
          { status: 'SHIPPED',    cnt: BigInt(1), total_cents: BigInt(3000) },
          { status: 'DELIVERED',  cnt: BigInt(1), total_cents: BigInt(4000) },
          { status: 'CANCELLED',  cnt: BigInt(1), total_cents: BigInt(5000) },
        ],
      });

      const result = await service.getStats();

      expect(result.totalSalesCents).toBe(10000); // 1000+2000+3000+4000, not +5000
      expect(result.ordersCount).toBe(4);
    });
  });
});
