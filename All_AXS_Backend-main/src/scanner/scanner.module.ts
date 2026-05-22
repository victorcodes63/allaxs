import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'src/auth/auth.module';
import { ScannerSession } from './entities/scanner-session.entity';
import { ScannerSessionGuard } from './guards/scanner-session.guard';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { OrganizerScannerController } from './organizer-scanner.controller';
import { Ticket } from 'src/domain/ticket.entity';
import { CheckIn } from 'src/domain/checkin.entity';
import { Event } from 'src/events/entities/event.entity';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([ScannerSession, Ticket, CheckIn, Event]),
  ],
  controllers: [ScanController, OrganizerScannerController],
  providers: [ScanService, ScannerSessionGuard],
  exports: [ScannerSessionGuard],
})
export class ScannerModule {}
