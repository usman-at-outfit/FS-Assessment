import {
  IsString, IsInt, Min, IsOptional, IsArray, IsUrl, IsNotEmpty, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;

  /** Price in integer cents. Must be > 0. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceCents?: number;

  /** Stock quantity. 0 = out of stock. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  /**
   * Replaces all gallery images. First URL becomes the primary `imageUrl`.
   * Pass [] to clear all images.
   */
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
