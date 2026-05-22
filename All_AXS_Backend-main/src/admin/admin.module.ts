import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminController } from './admin.controller';
import { OrderRefundService } from './order-refund.service';
import { AdminTicketScanController } from './admin-ticket-scan.controller';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { DomainModule } from '../domain/domain.module';
import { ScanModule } from '../scan/scan.module';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { PayoutBatch } from '../domain/payout-batch.entity';
import { PayoutBatchLine } from '../domain/payout-batch-line.entity';
import { PayoutBatchesService } from './payout-batches.service';
import { AdminPayoutBatchesController } from './admin-payout-batches.controller';
import { AdminRefundRequestsController } from './admin-refund-requests.controller';
import { RefundRequestsService } from './refund-requests.service';
import { RefundRequest } from '../domain/refund-request.entity';
import { OrganizersModule } from '../organizers/organizers.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminAuditLog,
      Event,
      TicketType,
      Order,
      OrderItem,
      User,
      OrganizerProfile,
      PayoutBatch,
      PayoutBatchLine,
      RefundRequest,
    ]),
    AuthModule,
    EventsModule,
    UsersModule,
    DomainModule,
    ScanModule,
    OrganizersModule,
    PaymentsModule,
  ],
  controllers: [
    AdminController,
    AdminTicketScanController,
    AdminPayoutBatchesController,
    AdminRefundRequestsController,
  ],
  providers: [
    AdminAuditService,
    AdminAuditInterceptor,
    OrderRefundService,
    PayoutBatchesService,
    RefundRequestsService,
  ],
  exports: [AdminAuditService, RefundRequestsService],
})
export class AdminModule {}
