import {
  Controller, Get, Post, Patch,
  Param, ParseIntPipe, Body, Query,
  UseGuards, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { ConfirmStripeDto } from './dto/confirm-stripe.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  checkout(@CurrentUser() u: { userId: number; role: string }) {
    if (u.role === 'ADMIN') throw new ForbiddenException('Admins cannot place orders');
    return this.ordersService.checkout(u.userId);
  }

  @Post('checkout/stripe-session')
  @HttpCode(HttpStatus.CREATED)
  createStripeSession(@CurrentUser() u: { userId: number; role: string }) {
    if (u.role === 'ADMIN') throw new ForbiddenException('Admins cannot place orders');
    return this.ordersService.createStripeSession(u.userId);
  }

  @Post('checkout/confirm')
  @HttpCode(HttpStatus.CREATED)
  confirmStripe(
    @CurrentUser() u: { userId: number; role: string },
    @Body() dto: ConfirmStripeDto,
  ) {
    if (u.role === 'ADMIN') throw new ForbiddenException('Admins cannot place orders');
    return this.ordersService.confirmStripeCheckout(u.userId, dto.sessionId);
  }

  @Get()
  findAll(@CurrentUser() u: { userId: number; role: string }) {
    if (u.role === 'ADMIN') throw new ForbiddenException('Admins cannot place orders');
    return this.ordersService.findAll(u.userId);
  }

  // ─── Admin endpoints (must be declared before :id to avoid pattern shadowing) ───

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAllAdmin(@Query() q: QueryAdminOrdersDto) {
    return this.ordersService.findAllAdmin(q);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOneAdmin(id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() u: { userId: number; role: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (u.role === 'ADMIN') throw new ForbiddenException('Admins cannot access customer orders');
    return this.ordersService.findOne(u.userId, id);
  }

  // Explicit guard order: JWT authentication must pass before role check
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
