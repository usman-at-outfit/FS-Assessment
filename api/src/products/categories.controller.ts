import {
  Controller, Get, Post, Patch, Param, ParseIntPipe,
  Body, UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty, IsUrl, MinLength, MaxLength, Matches } from 'class-validator';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug may only contain lowercase letters, digits, and hyphens' })
  slug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug may only contain lowercase letters, digits, and hyphens' })
  slug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}

class UpdateCategoryImageDto {
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  imageUrl: string;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateCategoryDto) {
    const slug = dto.slug ?? toSlug(dto.name);
    return this.productsService.createCategory(dto.name, slug, dto.imageUrl);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(id, dto);
  }

  @Patch(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryImageDto,
  ) {
    return this.productsService.updateCategoryImage(id, dto.imageUrl);
  }
}
