import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { UploadsController } from './uploads.controller';
import { TicketTypesController } from './ticket-types.controller';
import { EventsService } from './events.service';
import { TicketTypesService } from './ticket-types.service';
import { InstallmentConfigValidator } from './installment-config.validator';
import { Event } from './entities/event.entity';
import { Coupon } from './entities/coupon.entity';
import { TicketType } from './entities/ticket-type.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { StorageModule } from '../storage/storage.module';
import { OrderItem } from '../domain/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      Coupon,
      TicketType,
      OrganizerProfile,
      OrderItem,
    ]),
    StorageModule,
  ],
  controllers: [EventsController, UploadsController, TicketTypesController],
  providers: [EventsService, TicketTypesService, InstallmentConfigValidator],
  exports: [EventsService, TicketTypesService, InstallmentConfigValidator],
})
export class EventsModule {}
