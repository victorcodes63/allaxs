import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Event } from '../events/entities/event.entity';
import { Order } from '../domain/order.entity';
import { OrderStatus } from '../domain/enums';
import { EmailService } from '../auth/services/email.service';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { CreateEventAnnouncementDto } from './dto/create-event-announcement.dto';

@Injectable()
export class OrganizerEventAnnouncementsService {
  private readonly logger = new Logger(OrganizerEventAnnouncementsService.name);

  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(AdminAuditLog)
    private readonly adminAuditLogRepository: Repository<AdminAuditLog>,
    private readonly emailService: EmailService,
  ) {}

  private async getOrganizerProfileOrThrow(
    userId: string,
  ): Promise<OrganizerProfile> {
    const profile = await this.organizerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Organizer profile not found. Please complete organizer onboarding first.',
      );
    }
    return profile;
  }

  private async assertEventOwned(
    eventId: string,
    userId: string,
  ): Promise<Event> {
    const profile = await this.getOrganizerProfileOrThrow(userId);
    const event = await this.eventRepository.findOne({
      where: { id: eventId, organizer: { id: profile.id } },
    });
    if (!event) {
      throw new ForbiddenException(
        'Event not found or you do not have access to it.',
      );
    }
    return event;
  }

  async countPaidBuyerRecipients(
    eventId: string,
    userId: string,
  ): Promise<{ recipientCount: number }> {
    await this.assertEventOwned(eventId, userId);
    const emails = await this.loadDistinctPaidBuyerEmails(eventId);
    return { recipientCount: emails.length };
  }

  async sendAnnouncement(
    eventId: string,
    userId: string,
    dto: CreateEventAnnouncementDto,
  ): Promise<{
    recipientCount: number;
    sentCount: number;
    failedCount: number;
  }> {
    const event = await this.assertEventOwned(eventId, userId);
    const recipients = await this.loadDistinctPaidBuyerEmails(eventId);

    if (recipients.length === 0) {
      throw new BadRequestException(
        'No paid buyers with email addresses found for this event.',
      );
    }

    const { sent, failed } =
      await this.emailService.sendOrganizerAnnouncementBatch({
        recipients,
        subject: dto.subject.trim(),
        eventTitle: event.title,
        bodyHtml: dto.bodyHtml,
      });

    await this.recordAnnouncementAudit(userId, eventId, {
      subject: dto.subject.trim(),
      recipientCount: recipients.length,
      sentCount: sent,
      failedCount: failed,
    });

    return {
      recipientCount: recipients.length,
      sentCount: sent,
      failedCount: failed,
    };
  }

  private async loadDistinctPaidBuyerEmails(eventId: string): Promise<string[]> {
    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.email', 'email')
      .where('o.eventId = :eventId', { eventId })
      .andWhere('o.status = :status', { status: OrderStatus.PAID })
      .andWhere('o.email IS NOT NULL')
      .andWhere("TRIM(o.email) <> ''")
      .distinct(true)
      .getRawMany<{ email: string }>();

    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      const normalized = (row.email ?? '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(row.email.trim());
    }
    return out;
  }

  private async recordAnnouncementAudit(
    actorId: string,
    eventId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.adminAuditLogRepository.save(
        this.adminAuditLogRepository.create({
          adminUserId: actorId,
          action: 'ORGANIZER_EVENT_ANNOUNCEMENT',
          resourceType: 'event',
          resourceId: eventId,
          metadata,
          status: 'SUCCESS',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to record audit entry for announcement on event ${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
