import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SuggestionsService } from './suggestions.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { Request } from 'express';

class SuggestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exclude?: number;
}

@Controller('suggestions')
@UseGuards(OptionalJwtAuthGuard)
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  getSuggestions(
    @Req() req: Request & { user?: { userId: number } },
    @Query() query: SuggestionsQueryDto,
  ) {
    const userId = req.user?.userId ?? null;
    return this.suggestionsService.getSuggestions(userId, query.exclude);
  }
}
