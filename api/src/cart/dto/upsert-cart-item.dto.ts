import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}
