import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORY = { id: 1, name: 'Gadgets', slug: 'gadgets', imageUrl: null };

const PRODUCT = {
  id: 1,
  name: 'Widget',
  description: 'A widget',
  priceCents: 1999,
  imageUrl: 'http://example.com/img.jpg',
  stock: 10,
  categoryId: 1,
  createdAt: new Date(),
  category: { id: 1, name: 'Gadgets', slug: 'gadgets' },
  images: [],
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product:      { findMany: jest.Mock; findUnique: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    category:     { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    orderItem:    { count: jest.Mock };
    cartItem:     { deleteMany: jest.Mock };
    productImage: { deleteMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        count:      jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
      },
      category: {
        findMany: jest.fn(),
        create:   jest.fn(),
        update:   jest.fn(),
      },
      orderItem:    { count: jest.fn() },
      cartItem:     { deleteMany: jest.fn() },
      productImage: { deleteMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated items and total with default page/pageSize', async () => {
      prisma.product.findMany.mockResolvedValue([PRODUCT]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toEqual({ items: [PRODUCT], total: 1, page: 1, pageSize: 12 });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 12 }),
      );
    });

    it('applies search filter as case-insensitive contains', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ search: 'widget' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: { contains: 'widget', mode: 'insensitive' } }),
        }),
      );
    });

    it('applies category filter by slug', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ category: 'gadgets' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: { slug: 'gadgets' } }),
        }),
      );
    });

    it('applies minPrice and maxPrice filters in cents', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ minPrice: 500, maxPrice: 2000 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priceCents: { gte: 500, lte: 2000 } }),
        }),
      );
    });

    it('sorts by price ascending when sort=price_asc', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'price_asc' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { priceCents: 'asc' } }),
      );
    });

    it('sorts by price descending when sort=price_desc', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'price_desc' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { priceCents: 'desc' } }),
      );
    });

    it('defaults to newest sort when no sort param', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('respects custom page and pageSize', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, pageSize: 5 });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(5);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the product when it exists', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);

      const result = await service.findOne(1);

      expect(result).toEqual(PRODUCT);
      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findCategories ──────────────────────────────────────────────────────────

  describe('findCategories', () => {
    it('returns all categories ordered by name', async () => {
      prisma.category.findMany.mockResolvedValue([CATEGORY]);

      const result = await service.findCategories();

      expect(result).toEqual([CATEGORY]);
      expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  // ─── createCategory ──────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('creates and returns the new category', async () => {
      prisma.category.create.mockResolvedValue(CATEGORY);

      const result = await service.createCategory('Gadgets', 'gadgets');

      expect(result).toEqual(CATEGORY);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { name: 'Gadgets', slug: 'gadgets', imageUrl: undefined },
      });
    });

    it('throws ConflictException on duplicate name or slug (P2002)', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.category.create.mockRejectedValue(p2002);

      await expect(service.createCategory('Gadgets', 'gadgets')).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown errors unchanged', async () => {
      const unknownErr = new Error('DB connection lost');
      prisma.category.create.mockRejectedValue(unknownErr);

      await expect(service.createCategory('Gadgets', 'gadgets')).rejects.toThrow('DB connection lost');
    });
  });

  // ─── updateCategory ──────────────────────────────────────────────────────────

  describe('updateCategory', () => {
    it('updates and returns the category', async () => {
      const updated = { ...CATEGORY, name: 'Electronics' };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.updateCategory(1, { name: 'Electronics' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when category does not exist (P2025)', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      prisma.category.update.mockRejectedValue(p2025);

      await expect(service.updateCategory(99, { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on duplicate name/slug (P2002)', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.category.update.mockRejectedValue(p2002);

      await expect(service.updateCategory(1, { name: 'Duplicate' })).rejects.toThrow(ConflictException);
    });
  });

  // ─── updateCategoryImage ─────────────────────────────────────────────────────

  describe('updateCategoryImage', () => {
    it('updates and returns the category with new imageUrl', async () => {
      const updated = { ...CATEGORY, imageUrl: 'http://new.img' };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.updateCategoryImage(1, 'http://new.img');

      expect(result).toEqual(updated);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data:  { imageUrl: 'http://new.img' },
      });
    });

    it('throws NotFoundException when category not found (P2025)', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      prisma.category.update.mockRejectedValue(p2025);

      await expect(service.updateCategoryImage(99, 'http://x.img')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a product and sets imageUrl to the first imageUrl', async () => {
      prisma.product.create.mockResolvedValue(PRODUCT);

      const result = await service.create({
        name: 'Widget',
        description: 'A widget',
        priceCents: 1999,
        stock: 10,
        categoryId: 1,
        imageUrls: ['http://example.com/img.jpg', 'http://example.com/img2.jpg'],
      });

      expect(result).toEqual(PRODUCT);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageUrl: 'http://example.com/img.jpg',
            images: {
              create: [
                { url: 'http://example.com/img.jpg', sortOrder: 0 },
                { url: 'http://example.com/img2.jpg', sortOrder: 1 },
              ],
            },
          }),
        }),
      );
    });

    it('sets imageUrl to empty string when no imageUrls are provided', async () => {
      prisma.product.create.mockResolvedValue({ ...PRODUCT, imageUrl: '' });

      await service.create({
        name: 'Widget',
        description: 'A widget',
        priceCents: 1999,
        stock: 10,
        categoryId: 1,
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: '' }),
        }),
      );
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates product fields without touching images when imageUrls not provided', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.product.update.mockResolvedValue({ ...PRODUCT, stock: 5 });

      const result = await service.update(1, { stock: 5 });

      expect(result.stock).toBe(5);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces images atomically via $transaction when imageUrls are provided', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      prisma.productImage.create.mockResolvedValue({});
      prisma.$transaction.mockResolvedValue([]);
      prisma.product.update.mockResolvedValue(PRODUCT);

      await service.update(1, { imageUrls: ['http://new.img'] });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: 'http://new.img' }),
        }),
      );
    });

    it('throws NotFoundException for a non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update(99, { stock: 5 })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a product that has no historical order items', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.orderItem.count.mockResolvedValue(0);
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
      prisma.product.delete.mockResolvedValue(PRODUCT);

      await service.remove(1);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { productId: 1 } });
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws ConflictException when product has historical order items', async () => {
      prisma.product.findUnique.mockResolvedValue(PRODUCT);
      prisma.orderItem.count.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a non-existent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });
});
