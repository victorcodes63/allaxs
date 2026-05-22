import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
// ApiProperty / ApiPropertyOptional used by inline SendInviteDto below
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IsEmail, IsOptional, MaxLength } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { GetUser } from 'src/auth/decorators/current-user.decorator';
import type { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Role } from 'src/domain/enums';
import { EmailService } from 'src/auth/services/email.service';
import { ScannerSession } from './entities/scanner-session.entity';
import { CreateScannerSessionDto } from './dto/create-scanner-session.dto';
import { Event } from 'src/events/entities/event.entity';

class SendInviteDto {
  @ApiProperty({ description: 'Email address to send the scanner invite to' })
  @IsEmail()
  @MaxLength(254)
  volunteerEmail!: string;

  @ApiPropertyOptional({ description: 'Volunteer name for personalisation' })
  @IsOptional()
  @MaxLength(120)
  volunteerName?: string;
}

@ApiTags('organizer-scanner')
@Controller('organizer/events/:eventId/scanner-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@ApiBearerAuth()
export class OrganizerScannerController {
  constructor(
    @InjectRepository(ScannerSession)
    private readonly sessionRepo: Repository<ScannerSession>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private async assertOwnership(eventId: string, userId: string): Promise<Event> {
    // Only load the 'organizer' relation — we just need organizerProfile.userId
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // OrganizerProfile.userId is the UUID of the User who owns this profile
    if (event.organizer?.userId !== userId) {
      throw new ForbiddenException('You do not own this event');
    }

    return event;
  }

  private scanUrl(token: string): string {
    const base = this.configService.get<string>('SCANNER_APP_URL', 'http://localhost:3001');
    return `${base}/s/${token}`;
  }

  private async sendInvite(
    session: ScannerSession,
    event: Event,
    volunteerEmail: string,
    organizerName: string,
  ): Promise<void> {
    await this.emailService.sendScannerInviteEmail({
      to: volunteerEmail,
      label: session.label,
      eventTitle: event.title,
      scanUrl: this.scanUrl(session.token),
      expiresAt: session.expiresAt,
      organizerName,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a scanner session link for a door/gate' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 201, description: 'Scanner session created with scanUrl' })
  @ApiResponse({ status: 403, description: 'Not the event owner' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateScannerSessionDto,
    @GetUser() user: CurrentUser,
  ) {
    const event = await this.assertOwnership(eventId, user.id);

    const token = crypto.randomBytes(32).toString('hex');

    const session = this.sessionRepo.create({
      eventId,
      createdByOrganizerId: user.id,
      label: dto.label,
      token,
      expiresAt: new Date(dto.expiresAt),
      zoneScope: dto.zoneScope ?? null,
    });

    const saved = await this.sessionRepo.save(session);

    if (dto.volunteerEmail) {
      const organizerName = user.name ?? user.email;
      await this.sendInvite(saved, event, dto.volunteerEmail, organizerName);
    }

    return {
      ...saved,
      scanUrl: this.scanUrl(saved.token),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all scanner sessions for an event (newest first)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'List of scanner sessions' })
  async list(
    @Param('eventId') eventId: string,
    @GetUser() user: CurrentUser,
  ) {
    await this.assertOwnership(eventId, user.id);

    const sessions = await this.sessionRepo.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });

    return sessions.map((s) => ({
      ...s,
      scanUrl: this.scanUrl(s.token),
    }));
  }

  @Post(':sessionId/send-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send (or re-send) a scanner invite email to a volunteer' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({ name: 'sessionId', description: 'Scanner Session ID' })
  @ApiBody({ type: SendInviteDto })
  @ApiResponse({ status: 200, description: 'Invite email dispatched' })
  @ApiResponse({ status: 403, description: 'Not the event owner or session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async sendInviteEmail(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendInviteDto,
    @GetUser() user: CurrentUser,
  ) {
    const event = await this.assertOwnership(eventId, user.id);

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, eventId },
    });

    if (!session) {
      throw new NotFoundException('Scanner session not found');
    }

    if (session.revokedAt) {
      throw new ForbiddenException('Cannot send invite for a revoked session');
    }

    const organizerName = user.name ?? user.email;

    await this.sendInvite(session, event, dto.volunteerEmail, organizerName);

    return { sent: true, to: dto.volunteerEmail };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a scanner session (soft delete)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiParam({ name: 'sessionId', description: 'Scanner Session ID' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 403, description: 'Not the event owner' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revoke(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @GetUser() user: CurrentUser,
  ) {
    await this.assertOwnership(eventId, user.id);

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, eventId },
    });

    if (!session) {
      throw new NotFoundException('Scanner session not found');
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
    }

    return {
      ...session,
      scanUrl: this.scanUrl(session.token),
    };
  }
}
