import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WaitlistEntry } from '../events/entities/waitlist-entry.entity';
import { WaitlistStatus } from '../domain/enums';
import { WaitlistService } from '../events/waitlist.service';
import { OrganizerScopeService } from './organizer-scope.service';

export type OrganizerWaitlistRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  email: string;
  name: string;
  phone: string | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  status: 'PENDING' | 'NOTIFIED' | 'CONVERTED' | 'CANCELLED';
  createdAt: string;
};

@Injectable()
export class OrganizerWaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly waitlistRepository: Repository<WaitlistEntry>,
    private readonly waitlistService: WaitlistService,
    private readonly scopeService: OrganizerScopeService,
  ) {}

  private mapStatus(status: WaitlistStatus): OrganizerWaitlistRow['status'] {
    switch (status) {
      case WaitlistStatus.WAITING:
      case WaitlistStatus.EXPIRED:
        return 'PENDING';
      case WaitlistStatus.NOTIFIED:
        return 'NOTIFIED';
      case WaitlistStatus.PURCHASED:
        return 'CONVERTED';
      case WaitlistStatus.CANCELLED:
      default:
        return 'CANCELLED';
    }
  }

  private serialize(entry: WaitlistEntry): OrganizerWaitlistRow {
    return {
      id: entry.id,
      eventId: entry.eventId,
      eventTitle: entry.event?.title ?? 'Event',
      email: entry.email,
      name: '',
      phone: null,
      ticketTypeId: entry.tierId ?? null,
      ticketTypeName: entry.tier?.name ?? null,
      status: this.mapStatus(entry.status),
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async listForUser(
    userId: string,
    eventId?: string,
  ): Promise<OrganizerWaitlistRow[]> {
    await this.scopeService.getProfileOrThrow(userId);
    const eventIds = await this.scopeService.getOwnedEventIds(userId);
    if (eventIds.length === 0) return [];

    if (eventId) {
      if (!eventIds.includes(eventId)) {
        throw new ForbiddenException('You do not manage this event');
      }
    }

    const targetIds = eventId ? [eventId] : eventIds;
    const entries = await this.waitlistRepository.find({
      where: { eventId: In(targetIds) },
      relations: ['event', 'tier'],
      order: { createdAt: 'DESC' },
    });
    return entries.map((e) => this.serialize(e));
  }

  private async assertEntryOwned(
    userId: string,
    entryId: string,
  ): Promise<WaitlistEntry> {
    const eventIds = await this.scopeService.getOwnedEventIds(userId);
    const entry = await this.waitlistRepository.findOne({
      where: { id: entryId, eventId: In(eventIds.length ? eventIds : ['']) },
      relations: ['event', 'tier'],
    });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    return entry;
  }

  async notifyForUser(userId: string, entryId: string): Promise<{ ok: true }> {
    await this.assertEntryOwned(userId, entryId);
    await this.waitlistService.notifyEntryById(entryId);
    return { ok: true };
  }

  async cancelForUser(userId: string, entryId: string): Promise<{ ok: true }> {
    await this.assertEntryOwned(userId, entryId);
    await this.waitlistService.cancelEntryById(entryId);
    return { ok: true };
  }
}
