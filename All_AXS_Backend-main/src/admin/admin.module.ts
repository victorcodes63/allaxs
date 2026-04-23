import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { DomainModule } from '../domain/domain.module';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminAuditLog, Event, Order, User]),
    EventsModule,
    UsersModule,
    DomainModule,
  ],
  controllers: [AdminController],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminModule {}
