import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images:   { orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: QueryProductsDto) {
    const page     = q.page     ?? 1;
    const pageSize = q.pageSize ?? 12;
    const skip     = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};

    if (q.search) {
      where['name'] = { contains: q.search, mode: 'insensitive' };
    }
    if (q.category) {
      where['category'] = { slug: q.category };
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (q.minPrice !== undefined) priceFilter['gte'] = q.minPrice;
      if (q.maxPrice !== undefined) priceFilter['lte'] = q.maxPrice;
      where['priceCents'] = priceFilter;
    }

    let orderBy: Record<string, string>;
    switch (q.sort) {
      case 'price_asc':  orderBy = { priceCents: 'asc'  }; break;
      case 'price_desc': orderBy = { priceCents: 'desc' }; break;
      default:           orderBy = { createdAt:  'desc' }; break;
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: where as any,
        orderBy: orderBy as any,
        skip,
        take: pageSize,
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where: where as any }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async findCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  // ─── Admin write operations ──────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const imageUrls = dto.imageUrls ?? [];
    const primaryUrl = imageUrls[0] ?? '';

    return this.prisma.product.create({
      data: {
        name:        dto.name,
        description: dto.description,
        priceCents:  dto.priceCents,
        stock:       dto.stock,
        categoryId:  dto.categoryId,
        imageUrl:    primaryUrl,
        images: {
          create: imageUrls.map((url, i) => ({ url, sortOrder: i })),
        },
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    // Verify product exists first
    await this.findOne(id);

    // Build base update data
    const data: Record<string, unknown> = {};
    if (dto.name        !== undefined) data['name']        = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.priceCents  !== undefined) data['priceCents']  = dto.priceCents;
    if (dto.stock       !== undefined) data['stock']       = dto.stock;
    if (dto.categoryId  !== undefined) data['categoryId']  = dto.categoryId;

    // If imageUrls provided, replace all gallery images atomically
    if (dto.imageUrls !== undefined) {
      const primaryUrl = dto.imageUrls[0] ?? '';
      data['imageUrl'] = primaryUrl;

      // Delete existing images and recreate (simpler than a diff/upsert)
      await this.prisma.$transaction([
        this.prisma.productImage.deleteMany({ where: { productId: id } }),
        ...dto.imageUrls.map((url, i) =>
          this.prisma.productImage.create({ data: { productId: id, url, sortOrder: i } }),
        ),
      ]);
    }

    return this.prisma.product.update({
      where: { id },
      data:  data as any,
      include: PRODUCT_INCLUDE,
    });
  }

  async remove(id: number) {
    // Check product exists
    await this.findOne(id);

    // Refuse to delete if this product appears in any completed/historical order items.
    // We preserve the price snapshot integrity and foreign-key integrity.
    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      throw new ConflictException(
        `Product #${id} has ${orderItemCount} historical order item(s) and cannot be deleted. ` +
        'Set stock to 0 to hide it from the catalog instead.',
      );
    }

    // Remove from any active carts first
    await this.prisma.cartItem.deleteMany({ where: { productId: id } });

    // ProductImage rows are cascade-deleted by the DB (onDelete: Cascade in schema)
    await this.prisma.product.delete({ where: { id } });
  }
}
