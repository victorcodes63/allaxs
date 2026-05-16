import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfilesService } from './organizer-profiles.service';
import { OrganizerProfilesController } from './organizer-profiles.controller';
import { OrganizerSalesService } from './organizer-sales.service';
import { OrganizerSalesController } from './organizer-sales.controller';
import { OrganizerTicketsService } from './organizer-tickets.service';
import { OrganizerTicketsController } from './organizer-tickets.controller';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { Ticket } from '../domain/ticket.entity';
import { AuthModule } from '../auth/auth.module';
import { ScanModule } from '../scan/scan.module';
import { DomainModule } from '../domain/domain.module';
import { OrganizerEarningsController } from './organizer-earnings.controller';
import { OrganizerEarningsService } from './organizer-earnings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizerProfile,
      User,
      Event,
      Order,
      OrderItem,
      Ticket,
    ]),
    AuthModule,
    ScanModule,
    DomainModule,
  ],
  controllers: [
    OrganizerProfilesController,
    OrganizerSalesController,
    OrganizerTicketsController,
    OrganizerEarningsController,
  ],
  providers: [
    OrganizerProfilesService,
    OrganizerSalesService,
    OrganizerTicketsService,
    OrganizerEarningsService,
  ],
  exports: [
    OrganizerProfilesService,
    OrganizerSalesService,
    OrganizerTicketsService,
  ],
})
export class OrganizersModule {}
