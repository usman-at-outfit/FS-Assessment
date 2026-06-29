import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryProductsDto } from './dto/query-products.dto';

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
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.product.count({ where: where as any }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async findCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
}
