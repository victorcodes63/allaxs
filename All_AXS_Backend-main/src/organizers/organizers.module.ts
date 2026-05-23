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
import { OrganizerAnalyticsController } from './organizer-analytics.controller';
import { OrganizerAnalyticsService } from './organizer-analytics.service';
import { OrganizerEventAnnouncementsController } from './organizer-event-announcements.controller';
import { OrganizerEventAnnouncementsService } from './organizer-event-announcements.service';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizationInvite } from './entities/organization-invite.entity';
import { OrganizationAccessService } from './organization-access.service';
import { OrganizationTeamService } from './organization-team.service';
import { OrganizationTeamController } from './organization-team.controller';
import { UsersModule } from '../users/users.module';
import { OrganizerCustomersController } from './organizer-customers.controller';
import { OrganizerCustomersService } from './organizer-customers.service';
import { OrganizerPayoutRequestsController } from './organizer-payout-requests.controller';
import { OrganizerPayoutRequestsService } from './organizer-payout-requests.service';
import { PayoutWithdrawRequest } from './entities/payout-withdraw-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizerProfile,
      User,
      Event,
      Order,
      OrderItem,
      Ticket,
      AdminAuditLog,
      OrganizationMember,
      OrganizationInvite,
      PayoutWithdrawRequest,
    ]),
    AuthModule,
    ScanModule,
    DomainModule,
    UsersModule,
  ],
  controllers: [
    OrganizerProfilesController,
    OrganizerSalesController,
    OrganizerTicketsController,
    OrganizerEarningsController,
    OrganizerAnalyticsController,
    OrganizerEventAnnouncementsController,
    OrganizationTeamController,
    OrganizerCustomersController,
    OrganizerPayoutRequestsController,
  ],
  providers: [
    OrganizerProfilesService,
    OrganizerSalesService,
    OrganizerTicketsService,
    OrganizerEarningsService,
    OrganizerAnalyticsService,
    OrganizerEventAnnouncementsService,
    OrganizationAccessService,
    OrganizationTeamService,
    OrganizerCustomersService,
    OrganizerPayoutRequestsService,
  ],
  exports: [
    OrganizerProfilesService,
    OrganizerSalesService,
    OrganizerTicketsService,
    OrganizerAnalyticsService,
    OrganizationAccessService,
  ],
})
export class OrganizersModule {}
