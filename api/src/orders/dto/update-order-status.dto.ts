import { IsDefined, IsIn } from 'class-validator';
import { OrderStatus } from '@prisma/client';

const ALLOWED: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export class UpdateOrderStatusDto {
  @IsDefined()
  @IsIn(ALLOWED)
  status!: OrderStatus;
}
