import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { Event } from '../events/entities/event.entity';
import { Ticket } from '../domain/ticket.entity';
import { OrderStatus, TicketStatus } from '../domain/enums';

export type OrganizerTicketRow = {
  id: string;
  status: string;
  issuedAt: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  orderId: string;
  orderStatus: string;
  tierId: string;
  tierName: string;
  currency: string;
  attendeeEmail: string;
  attendeeName: string;
  attendeePhone: string;
  buyerEmail: string;
};

function escapeLike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

@Injectable()
export class OrganizerTicketsService {
  constructor(
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
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

  async listTickets(
    userId: string,
    opts: {
      eventId?: string;
      status?: TicketStatus;
      q?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{
    tickets: OrganizerTicketRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);

    if (opts.eventId) {
      const owned = await this.eventRepository.findOne({
        where: { id: opts.eventId, organizer: { id: profile.id } },
      });
      if (!owned) {
        throw new ForbiddenException(
          'Event not found or you do not have access to it.',
        );
      }
    }

    const qb = this.ticketRepository
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.order', 'o')
      .innerJoinAndSelect('o.event', 'e')
      .innerJoin('e.organizer', 'org')
      .leftJoinAndSelect('t.ticketType', 'tt')
      .where('org.id = :profileId', { profileId: profile.id })
      .andWhere('o.status = :paid', { paid: OrderStatus.PAID });

    if (opts.eventId) {
      qb.andWhere('e.id = :eventId', { eventId: opts.eventId });
    }
    if (opts.status) {
      qb.andWhere('t.status = :tstatus', { tstatus: opts.status });
    }
    if (opts.q && opts.q.trim()) {
      const needle = `%${escapeLike(opts.q.trim())}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.attendee_email ILIKE :needle ESCAPE :esc', {
            needle,
            esc: '\\',
          })
            .orWhere('t.attendee_name ILIKE :needle ESCAPE :esc', {
              needle,
              esc: '\\',
            })
            .orWhere('o.email ILIKE :needle ESCAPE :esc', {
              needle,
              esc: '\\',
            })
            .orWhere('CAST(t.id AS text) ILIKE :needle ESCAPE :esc', {
              needle,
              esc: '\\',
            })
            .orWhere('CAST(o.id AS text) ILIKE :needle ESCAPE :esc', {
              needle,
              esc: '\\',
            });
        }),
      );
    }

    const total = await qb.clone().getCount();

    const rows = await qb
      .clone()
      .orderBy('t.createdAt', 'DESC')
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

    const tickets: OrganizerTicketRow[] = rows.map((t) => ({
      id: t.id,
      status: t.status,
      issuedAt: t.createdAt.toISOString(),
      eventId: t.order?.eventId ?? '',
      eventTitle: t.order?.event?.title ?? 'Event',
      eventSlug: t.order?.event?.slug ?? '',
      orderId: t.orderId,
      orderStatus: t.order?.status ?? '',
      tierId: t.ticketTypeId,
      tierName: t.ticketType?.name ?? 'Ticket',
      currency: t.ticketType?.currency ?? t.order?.currency ?? 'KES',
      attendeeEmail: t.attendeeEmail ?? '',
      attendeeName: (t.attendeeName ?? '').trim(),
      attendeePhone: (t.attendeePhone ?? '').trim(),
      buyerEmail: t.order?.email ?? '',
    }));

    return {
      tickets,
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  async updateTicketStatus(
    userId: string,
    ticketId: string,
    nextStatus: TicketStatus,
  ): Promise<{ ticket: OrganizerTicketRow }> {
    const profile = await this.getOrganizerProfileOrThrow(userId);

    const t = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: [
        'order',
        'order.event',
        'order.event.organizer',
        'ticketType',
      ],
    });
    if (!t || !t.order?.event) {
      throw new NotFoundException('Ticket not found');
    }

    const orgId = t.order.event.organizer?.id;
    if (!orgId || orgId !== profile.id) {
      throw new ForbiddenException(
        'You do not have permission to manage this ticket.',
      );
    }

    if (t.order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        'Only tickets from paid orders can be updated.',
      );
    }

    const cur = t.status;
    const allowed =
      (cur === TicketStatus.ISSUED && nextStatus === TicketStatus.CHECKED_IN) ||
      (cur === TicketStatus.CHECKED_IN && nextStatus === TicketStatus.ISSUED) ||
      (cur === TicketStatus.ISSUED && nextStatus === TicketStatus.VOID) ||
      (cur === TicketStatus.CHECKED_IN && nextStatus === TicketStatus.VOID);

    if (!allowed) {
      throw new BadRequestException(
        `Cannot change status from ${cur} to ${nextStatus}.`,
      );
    }

    t.status = nextStatus;
    await this.ticketRepository.save(t);

    const row: OrganizerTicketRow = {
      id: t.id,
      status: t.status,
      issuedAt: t.createdAt.toISOString(),
      eventId: t.order.eventId,
      eventTitle: t.order.event.title ?? 'Event',
      eventSlug: t.order.event.slug ?? '',
      orderId: t.orderId,
      orderStatus: t.order.status,
      tierId: t.ticketTypeId,
      tierName: t.ticketType?.name ?? 'Ticket',
      currency: t.ticketType?.currency ?? t.order.currency ?? 'KES',
      attendeeEmail: t.attendeeEmail ?? '',
      attendeeName: (t.attendeeName ?? '').trim(),
      attendeePhone: (t.attendeePhone ?? '').trim(),
      buyerEmail: t.order.email ?? '',
    };

    return { ticket: row };
  }
}
