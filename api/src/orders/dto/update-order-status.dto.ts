import { IsIn } from 'class-validator';
import { OrderStatus } from '@prisma/client';

const ALLOWED: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export class UpdateOrderStatusDto {
  @IsIn(ALLOWED)
  status!: OrderStatus;
}
