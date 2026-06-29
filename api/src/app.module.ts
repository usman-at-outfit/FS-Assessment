import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    SuggestionsModule,
    UploadsModule,
    AdminModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
