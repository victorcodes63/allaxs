import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { OrdersController } from './orders.controller';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [OrdersController],
})
export class OrdersModule {}
