import {
  Controller, Get, Post, Patch,
  Param, ParseIntPipe, Body, Query,
  UseGuards, HttpCode, HttpStatus,
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
  checkout(@CurrentUser('userId') userId: number) {
    return this.ordersService.checkout(userId);
  }

  @Post('checkout/stripe-session')
  @HttpCode(HttpStatus.CREATED)
  createStripeSession(@CurrentUser('userId') userId: number) {
    return this.ordersService.createStripeSession(userId);
  }

  @Post('checkout/confirm')
  @HttpCode(HttpStatus.CREATED)
  confirmStripe(
    @CurrentUser('userId') userId: number,
    @Body() dto: ConfirmStripeDto,
  ) {
    return this.ordersService.confirmStripeCheckout(userId, dto.sessionId);
  }

  @Get()
  findAll(@CurrentUser('userId') userId: number) {
    return this.ordersService.findAll(userId);
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
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.findOne(userId, id);
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
