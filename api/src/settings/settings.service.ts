import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.siteSetting.upsert({
      where:  { key },
      update: { value },
      create: { key, value },
    });
  }

  async getBannerImages(): Promise<string[]> {
    const raw = await this.get('bannerImages');
    if (raw) {
      try { return JSON.parse(raw) as string[]; } catch { return []; }
    }
    // Backward-compat: migrate from the old single-image key
    const legacy = await this.get('bannerImageUrl');
    if (legacy) return [legacy];
    return [];
  }

  async setBannerImages(images: string[]): Promise<void> {
    await this.set('bannerImages', JSON.stringify(images));
  }
}
