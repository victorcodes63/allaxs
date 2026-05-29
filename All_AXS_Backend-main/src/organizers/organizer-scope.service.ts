import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Event } from '../events/entities/event.entity';
import { OrganizationAccessService } from './organization-access.service';

/**
 * Resolves organizer profile + owned/editable event IDs for scoped queries.
 */
@Injectable()
export class OrganizerScopeService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly organizationAccessService: OrganizationAccessService,
  ) {}

  async getProfileOrThrow(userId: string): Promise<OrganizerProfile> {
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

  async getEditableOrganizerProfileIds(userId: string): Promise<string[]> {
    return this.organizationAccessService.getEditableOrganizerProfileIds(
      userId,
    );
  }

  async getOwnedEventIds(userId: string): Promise<string[]> {
    const profileIds =
      await this.organizationAccessService.getEditableOrganizerProfileIds(
        userId,
      );
    if (profileIds.length === 0) return [];
    const events = await this.eventRepository.find({
      where: { organizer: { id: In(profileIds) } },
      select: ['id'],
    });
    return events.map((e) => e.id);
  }

  async assertEventOwned(userId: string, eventId: string): Promise<Event> {
    const profileIds =
      await this.organizationAccessService.getEditableOrganizerProfileIds(
        userId,
      );
    const event = await this.eventRepository.findOne({
      where: { id: eventId, organizer: { id: In(profileIds) } },
      relations: ['organizer'],
    });
    if (!event) {
      throw new ForbiddenException('You do not manage this event');
    }
    return event;
  }

  async assertEventInScope(
    userId: string,
    eventId: string | null | undefined,
  ): Promise<void> {
    if (!eventId) return;
    await this.assertEventOwned(userId, eventId);
  }
}
