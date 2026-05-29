import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import {
  EventStatus,
  TicketTypeStatus,
  WaitlistStatus,
} from '../domain/enums';
import { EmailService } from '../auth/services/email.service';
import { Event } from './entities/event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

export type WaitlistPurchaseContext = {
  entryId: string;
  tierId: string;
  eventId: string;
  email: string;
};

const OFFER_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepo: Repository<WaitlistEntry>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async join(
    eventId: string,
    tierId: string,
    email: string,
    userId?: string | null,
  ): Promise<{ id: string; position: number; status: WaitlistStatus }> {
    const normalizedEmail = email.trim().toLowerCase();

    const event = await this.eventRepo.findOne({
      where: { id: eventId, status: EventStatus.PUBLISHED },
    });
    if (!event) {
      throw new NotFoundException('Published event not found');
    }

    const tier = await this.ticketTypeRepo.findOne({
      where: { id: tierId, eventId },
    });
    if (!tier) {
      throw new NotFoundException('Ticket tier not found for this event');
    }

    if (
      tier.status !== TicketTypeStatus.ACTIVE &&
      tier.status !== TicketTypeStatus.SOLD_OUT
    ) {
      throw new BadRequestException('This tier is not accepting waitlist sign-ups');
    }

    const remaining = tier.quantityTotal - tier.quantitySold;
    if (remaining > 0 && tier.status !== TicketTypeStatus.SOLD_OUT) {
      throw new BadRequestException(
        'This tier still has tickets available — purchase directly instead of joining the waitlist',
      );
    }

    const existing = await this.waitlistRepo.findOne({
      where: [
        {
          tierId,
          email: normalizedEmail,
          status: WaitlistStatus.WAITING,
        },
        {
          tierId,
          email: normalizedEmail,
          status: WaitlistStatus.NOTIFIED,
        },
      ],
    });
    if (existing) {
      throw new ConflictException('You are already on the waitlist for this tier');
    }

    const maxPosition = await this.waitlistRepo
      .createQueryBuilder('w')
      .select('MAX(w.position)', 'max')
      .where('w.tierId = :tierId', { tierId })
      .andWhere('w.status IN (:...statuses)', {
        statuses: [WaitlistStatus.WAITING, WaitlistStatus.NOTIFIED],
      })
      .getRawOne<{ max: string | null }>();

    const position = (maxPosition?.max ? parseInt(maxPosition.max, 10) : 0) + 1;

    const entry = this.waitlistRepo.create({
      eventId,
      tierId,
      email: normalizedEmail,
      userId: userId ?? null,
      position,
      status: WaitlistStatus.WAITING,
    });
    const saved = await this.waitlistRepo.save(entry);

    return {
      id: saved.id,
      position: saved.position,
      status: saved.status,
    };
  }

  /**
   * Called after a refund restores tier inventory. Notifies the first
   * waiting buyer when seats are available again.
   */
  async onInventoryFreed(tierId: string): Promise<void> {
    await this.expireStaleOffers(tierId);

    const tier = await this.ticketTypeRepo.findOne({
      where: { id: tierId },
      relations: ['event'],
    });
    if (!tier) return;

    const remaining = tier.quantityTotal - tier.quantitySold;
    if (remaining <= 0) return;
    if (tier.status !== TicketTypeStatus.ACTIVE) return;

    const entry = await this.waitlistRepo.findOne({
      where: { tierId, status: WaitlistStatus.WAITING },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    if (!entry) return;

    try {
      await this.notifyEntry(entry, tier);
    } catch (error) {
      this.logger.warn(
        `Waitlist notification failed for tier ${tierId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async verifyPurchaseToken(token: string): Promise<{
    valid: boolean;
    eventId?: string;
    tierId?: string;
    tierName?: string;
    eventTitle?: string;
    email?: string;
    expiresAt?: string;
    reason?: string;
  }> {
    const parsed = this.parseSignedToken(token);
    if (!parsed) {
      return { valid: false, reason: 'Invalid token' };
    }

    const entry = await this.waitlistRepo.findOne({
      where: { id: parsed.entryId },
      relations: ['tier', 'event'],
    });
    if (!entry) {
      return { valid: false, reason: 'Waitlist entry not found' };
    }
    if (entry.status !== WaitlistStatus.NOTIFIED) {
      return { valid: false, reason: 'This offer is no longer active' };
    }
    if (
      !entry.offerExpiresAt ||
      entry.offerExpiresAt.getTime() < Date.now()
    ) {
      await this.markExpired(entry.id);
      return { valid: false, reason: 'This offer has expired' };
    }
    if (parsed.expiresAt !== entry.offerExpiresAt.getTime()) {
      return { valid: false, reason: 'Invalid token' };
    }

    return {
      valid: true,
      eventId: entry.eventId,
      tierId: entry.tierId,
      tierName: entry.tier?.name,
      eventTitle: entry.event?.title,
      email: entry.email,
      expiresAt: entry.offerExpiresAt.toISOString(),
    };
  }

  async resolvePurchaseContext(
    token: string,
    buyerEmail: string,
    eventId: string,
  ): Promise<WaitlistPurchaseContext> {
    const verification = await this.verifyPurchaseToken(token);
    if (!verification.valid) {
      throw new BadRequestException(
        verification.reason ?? 'Invalid or expired waitlist purchase link',
      );
    }
    if (verification.eventId !== eventId) {
      throw new BadRequestException('Waitlist token does not match this event');
    }
    const normalizedBuyer = buyerEmail.trim().toLowerCase();
    if (verification.email !== normalizedBuyer) {
      throw new BadRequestException(
        'Checkout email must match the address on the waitlist offer',
      );
    }

    return {
      entryId: this.parseSignedToken(token)!.entryId,
      tierId: verification.tierId!,
      eventId: verification.eventId!,
      email: verification.email!,
    };
  }

  async markPurchased(entryId: string): Promise<void> {
    const entry = await this.waitlistRepo.findOne({ where: { id: entryId } });
    if (!entry || entry.status !== WaitlistStatus.NOTIFIED) return;
    entry.status = WaitlistStatus.PURCHASED;
    await this.waitlistRepo.save(entry);
  }

  markPurchasedFromOrderNotes(notes: string | undefined): Promise<void> {
    const entryId = this.extractWaitlistEntryId(notes);
    if (!entryId) return Promise.resolve();
    return this.markPurchased(entryId);
  }

  /** Organizer manual notify for a waiting entry. */
  async notifyEntryById(entryId: string): Promise<void> {
    const entry = await this.waitlistRepo.findOne({
      where: { id: entryId },
      relations: ['tier', 'tier.event'],
    });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (entry.status !== WaitlistStatus.WAITING) {
      throw new BadRequestException('Only waiting entries can be notified');
    }
    const tier =
      entry.tier ??
      (await this.ticketTypeRepo.findOne({
        where: { id: entry.tierId },
        relations: ['event'],
      }));
    if (!tier) {
      throw new NotFoundException('Ticket tier not found');
    }
    await this.notifyEntry(entry, tier);
  }

  /** Organizer cancel for a non-purchased waitlist entry. */
  async cancelEntryById(entryId: string): Promise<void> {
    const entry = await this.waitlistRepo.findOne({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (
      entry.status === WaitlistStatus.PURCHASED ||
      entry.status === WaitlistStatus.CANCELLED
    ) {
      throw new BadRequestException('This waitlist entry cannot be cancelled');
    }
    entry.status = WaitlistStatus.CANCELLED;
    await this.waitlistRepo.save(entry);
  }

  signPurchaseToken(entryId: string, expiresAt: Date): string {
    const exp = expiresAt.getTime();
    const payload = `${entryId}.${exp}`;
    const sig = crypto
      .createHmac('sha256', this.signingSecret())
      .update(payload)
      .digest('hex');
    return `${payload}.${sig}`;
  }

  private async notifyEntry(
    entry: WaitlistEntry,
    tier: TicketType,
  ): Promise<void> {
    const offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);
    const token = this.signPurchaseToken(entry.id, offerExpiresAt);

    entry.status = WaitlistStatus.NOTIFIED;
    entry.notifiedAt = new Date();
    entry.offerExpiresAt = offerExpiresAt;
    await this.waitlistRepo.save(entry);

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const purchaseUrl = `${frontendUrl}/events/${entry.eventId}/checkout?waitlist=${encodeURIComponent(token)}`;

    const event = tier.event ?? (await this.eventRepo.findOne({ where: { id: entry.eventId } }));
    if (!event) return;

    await this.emailService.sendWaitlistSpotAvailableEmail({
      to: entry.email,
      eventTitle: event.title,
      tierName: tier.name,
      purchaseUrl,
      expiresAt: offerExpiresAt,
    });
  }

  private async expireStaleOffers(tierId: string): Promise<void> {
    const stale = await this.waitlistRepo
      .createQueryBuilder('w')
      .where('w.tierId = :tierId', { tierId })
      .andWhere('w.status = :status', { status: WaitlistStatus.NOTIFIED })
      .andWhere('w.offerExpiresAt IS NOT NULL')
      .andWhere('w.offerExpiresAt < :now', { now: new Date() })
      .getMany();

    for (const entry of stale) {
      await this.markExpired(entry.id);
    }
  }

  private async markExpired(entryId: string): Promise<void> {
    const entry = await this.waitlistRepo.findOne({ where: { id: entryId } });
    if (!entry || entry.status !== WaitlistStatus.NOTIFIED) return;
    entry.status = WaitlistStatus.EXPIRED;
    await this.waitlistRepo.save(entry);
  }

  private parseSignedToken(
    token: string,
  ): { entryId: string; expiresAt: number } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [entryId, expStr, sig] = parts;
    const expiresAt = parseInt(expStr, 10);
    if (!entryId || !Number.isFinite(expiresAt)) return null;

    const payload = `${entryId}.${expiresAt}`;
    const expected = crypto
      .createHmac('sha256', this.signingSecret())
      .update(payload)
      .digest('hex');
    if (!this.safeEqual(sig, expected)) return null;
    return { entryId, expiresAt };
  }

  private signingSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET') || 'fallback-secret'
    );
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  }

  private extractWaitlistEntryId(notes: string | undefined): string | null {
    if (!notes) return null;
    try {
      const parsed = JSON.parse(notes) as { waitlistEntryId?: string };
      return parsed.waitlistEntryId ?? null;
    } catch {
      return null;
    }
  }
}
