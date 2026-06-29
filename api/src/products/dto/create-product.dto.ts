import {
  IsString, IsNotEmpty, IsInt, Min, IsOptional, IsArray, IsUrl, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  /** Price in integer cents. Must be > 0. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceCents!: number;

  /** Stock quantity. 0 = out of stock. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;

  /**
   * Image URLs in display order. First URL becomes the primary `imageUrl`.
   * Pass [] or omit to leave imageUrl blank (will default to empty string).
   */
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
