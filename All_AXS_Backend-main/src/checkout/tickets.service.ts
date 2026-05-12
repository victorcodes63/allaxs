import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../domain/ticket.entity';

export type TicketMineRow = {
  id: string;
  orderId: string;
  eventSlug: string;
  eventTitle: string;
  tierName: string;
  attendeeEmail: string;
  issuedAt: string;
  currency: string;
  qrNonce: string;
  qrSignature: string;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  private toTicketRow(t: Ticket): TicketMineRow {
    return {
      id: t.id,
      orderId: t.orderId,
      eventSlug: t.order?.event?.slug ?? '',
      eventTitle: t.order?.event?.title ?? 'Event',
      tierName: t.ticketType?.name ?? 'Ticket',
      attendeeEmail: t.attendeeEmail ?? '',
      issuedAt: t.createdAt.toISOString(),
      currency: t.ticketType?.currency ?? 'KES',
      qrNonce: t.qrNonce,
      qrSignature: t.qrSignature,
    };
  }

  async findMine(userId: string, userEmail?: string): Promise<{ tickets: TicketMineRow[] }> {
    if (userEmail) {
      // Backfill legacy guest/partial account tickets to the signed-in owner.
      await this.ticketRepository
        .createQueryBuilder()
        .update(Ticket)
        .set({ ownerUserId: userId })
        .where('ownerUserId IS NULL')
        .andWhere('attendeeEmail IS NOT NULL')
        .andWhere('LOWER(attendeeEmail) = LOWER(:email)', { email: userEmail })
        .execute();
    }

    const rows = await this.ticketRepository.find({
      where: { ownerUserId: userId },
      relations: ['order', 'order.event', 'ticketType'],
      order: { createdAt: 'DESC' },
    });

    const tickets: TicketMineRow[] = rows.map((t) => this.toTicketRow(t));

    return { tickets };
  }

  async findOneForOwner(
    userId: string,
    ticketId: string,
    userEmail?: string,
  ): Promise<{ ticket: TicketMineRow }> {
    if (userEmail) {
      await this.ticketRepository
        .createQueryBuilder()
        .update(Ticket)
        .set({ ownerUserId: userId })
        .where('id = :ticketId', { ticketId })
        .andWhere('ownerUserId IS NULL')
        .andWhere('attendeeEmail IS NOT NULL')
        .andWhere('LOWER(attendeeEmail) = LOWER(:email)', { email: userEmail })
        .execute();
    }

    const t = await this.ticketRepository.findOne({
      where: { id: ticketId, ownerUserId: userId },
      relations: ['order', 'order.event', 'ticketType'],
    });
    if (!t) {
      throw new NotFoundException('Ticket not found');
    }
    const ticket: TicketMineRow = this.toTicketRow(t);
    return { ticket };
  }
}
