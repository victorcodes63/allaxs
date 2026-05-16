import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { UploadsController } from './uploads.controller';
import { TicketTypesController } from './ticket-types.controller';
import { CouponsController } from './coupons.controller';
import { EventsService } from './events.service';
import { TicketTypesService } from './ticket-types.service';
import { CouponsService } from './coupons.service';
import { InstallmentConfigValidator } from './installment-config.validator';
import { Event } from './entities/event.entity';
import { Coupon } from './entities/coupon.entity';
import { TicketType } from './entities/ticket-type.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { OrderItem } from '../domain/order-item.entity';
import { CouponRedemption } from '../domain/coupon-redemption.entity';
import { NotificationsModule } from '../notifications/notifications.module';
// Imported as a plain entity (not the AdminModule) so the events services can
// write admin audit-log rows directly without introducing a circular module
// dependency (AdminModule already imports EventsModule).
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      Coupon,
      TicketType,
      OrganizerProfile,
      User,
      OrderItem,
      AdminAuditLog,
      CouponRedemption,
    ]),
    StorageModule,
    NotificationsModule,
  ],
  controllers: [
    EventsController,
    UploadsController,
    TicketTypesController,
    CouponsController,
  ],
  providers: [
    EventsService,
    TicketTypesService,
    CouponsService,
    InstallmentConfigValidator,
  ],
  exports: [
    EventsService,
    TicketTypesService,
    CouponsService,
    InstallmentConfigValidator,
  ],
})
export class EventsModule {}
