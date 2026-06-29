import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SetBannersDto } from './set-banner.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('banner')
  async getBanner() {
    const images = await this.settingsService.getBannerImages();
    return { images };
  }

  @Put('banner')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setBanner(@Body() dto: SetBannersDto) {
    await this.settingsService.setBannerImages(dto.images);
    return { images: dto.images };
  }
}
