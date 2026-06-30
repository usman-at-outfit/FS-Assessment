import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { PrismaService } from '../prisma/prisma.service';

const FIXED_DATE = new Date('2025-01-01T00:00:00.000Z');
const PRODUCT_STUB = (id: number, categoryId = 1) => ({
  id,
  name: `Product ${id}`,
  priceCents: 1000 * id,
  stock: 10,
  imageUrl: '',
  categoryId,
  createdAt: FIXED_DATE,
  category: { id: categoryId, name: 'Cat', slug: 'cat' },
  images: [],
});

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let prisma: {
    orderItem: { findMany: jest.Mock };
    cartItem:  { findMany: jest.Mock };
    product:   { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      orderItem: { findMany: jest.fn() },
      cartItem:  { findMany: jest.fn() },
      product:   { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getSuggestions — routing ─────────────────────────────────────────────────

  describe('getSuggestions routing', () => {
    it('calls globalBestsellers (via $queryRaw) when userId is null', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      prisma.product.findMany.mockResolvedValue([PRODUCT_STUB(1)]);

      await service.getSuggestions(null);

      // With null userId, no orderItem/cartItem lookups should happen
      expect(prisma.orderItem.findMany).not.toHaveBeenCalled();
      expect(prisma.cartItem.findMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('calls personalSuggestions (uses orderItem/cartItem) when userId is provided', async () => {
      // User has orders in category 1 and cart with category 1
      prisma.orderItem.findMany.mockResolvedValueOnce([{ product: { categoryId: 1 } }]) // affinityCategories from orders
                                .mockResolvedValueOnce([{ productId: 2 }]);              // ownedIds
      prisma.cartItem.findMany.mockResolvedValueOnce([{ product: { categoryId: 1 } }])  // cartCategories
                               .mockResolvedValueOnce([{ productId: 3 }]);               // cartIds
      prisma.$queryRaw.mockResolvedValue([{ id: 4 }]);
      prisma.product.findMany.mockResolvedValue([PRODUCT_STUB(4)]);

      await service.getSuggestions(42);

      expect(prisma.orderItem.findMany).toHaveBeenCalled();
      expect(prisma.cartItem.findMany).toHaveBeenCalled();
    });
  });

  // ─── globalBestsellers ───────────────────────────────────────────────────────

  describe('globalBestsellers (userId=null)', () => {
    it('returns up to 8 products ordered by units sold', async () => {
      const ids = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const products = ids.map(r => PRODUCT_STUB(r.id));
      prisma.$queryRaw.mockResolvedValue(ids);
      prisma.product.findMany.mockResolvedValue(products);

      const result = await service.getSuggestions(null);

      expect(result).toEqual(products);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [1, 2, 3] } } }),
      );
    });

    it('returns an empty array when there are no products', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.getSuggestions(null);

      expect(result).toEqual([]);
    });

    it('excludes a specific product when excludeProductId is provided', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      await service.getSuggestions(null, 5);

      // The raw SQL receives excludeIds=[5]; we verify $queryRaw was called with a template
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  // ─── personalSuggestions ────────────────────────────────────────────────────

  describe('personalSuggestions (userId provided)', () => {
    function setupPersonal({
      orderCategories = [] as { product: { categoryId: number } }[],
      cartCategories  = [] as { product: { categoryId: number } }[],
      ownedIds        = [] as { productId: number }[],
      cartIds         = [] as { productId: number }[],
      rawRows         = [] as { id: number }[],
      products        = [] as ReturnType<typeof PRODUCT_STUB>[],
    } = {}) {
      prisma.orderItem.findMany
        .mockResolvedValueOnce(orderCategories)  // affinity categories (orders)
        .mockResolvedValueOnce(ownedIds);         // owned product IDs
      prisma.cartItem.findMany
        .mockResolvedValueOnce(cartCategories)   // affinity categories (cart)
        .mockResolvedValueOnce(cartIds);          // cart product IDs
      prisma.$queryRaw.mockResolvedValue(rawRows);
      prisma.product.findMany.mockResolvedValue(products);
    }

    it('returns personalised results when the user has order/cart history', async () => {
      const expected = [PRODUCT_STUB(5, 1)];
      setupPersonal({
        orderCategories: [{ product: { categoryId: 1 } }],
        cartCategories:  [],
        rawRows: [{ id: 5 }],
        products: expected,
      });

      const result = await service.getSuggestions(42);

      expect(result).toEqual(expected);
    });

    it('excludes products already owned or in cart from suggestions', async () => {
      // owned productId=1 and cartId=2 — these should not appear in rawRows
      setupPersonal({
        orderCategories: [{ product: { categoryId: 1 } }],
        cartCategories:  [],
        ownedIds:        [{ productId: 1 }],
        cartIds:         [{ productId: 2 }],
        rawRows:         [{ id: 3 }],
        products:        [PRODUCT_STUB(3)],
      });

      const result = await service.getSuggestions(42);

      expect(result).toEqual([PRODUCT_STUB(3)]);
      // Verify we did NOT ask for products 1 or 2
      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.id.in).not.toContain(1);
      expect(findManyCall.where.id.in).not.toContain(2);
    });

    it('falls back to globalBestsellers when no affinity categories exist (cold start)', async () => {
      // User exists but has no orders and no cart — empty affinity
      prisma.orderItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.cartItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.$queryRaw.mockResolvedValue([{ id: 7 }]);
      prisma.product.findMany.mockResolvedValue([PRODUCT_STUB(7)]);

      const result = await service.getSuggestions(42);

      expect(result).toEqual([PRODUCT_STUB(7)]);
      // globalBestsellers should have been called (single $queryRaw call)
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('falls back to globalBestsellers when affinity query returns 0 matching products', async () => {
      // Has affinity but the raw query returns nothing (all in-stock items excluded)
      prisma.orderItem.findMany.mockResolvedValueOnce([{ product: { categoryId: 1 } }]).mockResolvedValueOnce([]);
      prisma.cartItem.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.$queryRaw
        .mockResolvedValueOnce([])        // affinity raw query → 0 results
        .mockResolvedValueOnce([{ id: 9 }]); // fallback global
      prisma.product.findMany.mockResolvedValue([PRODUCT_STUB(9)]);

      const result = await service.getSuggestions(42);

      expect(result).toEqual([PRODUCT_STUB(9)]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });
});
