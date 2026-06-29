import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
    },
  },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: number) {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: CART_INCLUDE,
    });
  }

  async upsertItem(userId: number, dto: UpsertCartItemDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Product #${dto.productId} not found`);

    // Ensure cart exists
    const cart = await this.prisma.cart.upsert({
      where:  { userId },
      create: { userId },
      update: {},
    });

    // Upsert the line
    await this.prisma.cartItem.upsert({
      where:  { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      create: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity },
      update: { quantity: dto.quantity },
    });

    return this.prisma.cart.findUnique({
      where: { userId },
      include: CART_INCLUDE,
    });
  }

  async removeItem(userId: number, productId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) return;

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId },
    });
  }

  async clearCart(userId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) return;
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
