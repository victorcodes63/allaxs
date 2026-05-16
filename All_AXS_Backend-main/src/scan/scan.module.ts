import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Ticket } from '../domain/ticket.entity';
import { CheckIn } from '../domain/checkin.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { TicketScanService } from './ticket-scan.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Ticket, CheckIn, OrganizerProfile]),
  ],
  providers: [TicketScanService],
  exports: [TicketScanService],
})
export class ScanModule {}
