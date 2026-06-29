import {
  Controller, Get, Post, Delete, Body,
  Param, ParseIntPipe, UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { UpsertCartItemDto } from './dto/upsert-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: { userId: number; role: string }) {
    if (user.role === 'ADMIN') throw new ForbiddenException('Admins cannot use the cart');
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  upsertItem(
    @CurrentUser() user: { userId: number; role: string },
    @Body() dto: UpsertCartItemDto,
  ) {
    if (user.role === 'ADMIN') throw new ForbiddenException('Admins cannot use the cart');
    return this.cartService.upsertItem(user.userId, dto);
  }

  @Delete('items/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @CurrentUser() user: { userId: number; role: string },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    if (user.role === 'ADMIN') throw new ForbiddenException('Admins cannot use the cart');
    return this.cartService.removeItem(user.userId, productId);
  }
}
