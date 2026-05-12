import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { DomainModule } from '../domain/domain.module';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { Order } from '../domain/order.entity';
import { User } from '../users/entities/user.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminAuditLog,
      Event,
      TicketType,
      Order,
      User,
      OrganizerProfile,
    ]),
    AuthModule,
    EventsModule,
    UsersModule,
    DomainModule,
  ],
  controllers: [AdminController],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminModule {}
