import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Ticket } from 'src/domain/ticket.entity';
import { CheckIn } from 'src/domain/checkin.entity';
import { ScannerSession } from './entities/scanner-session.entity';
import { OrderStatus, TicketStatus } from 'src/domain/enums';
import { parseTicketScanPayload } from 'src/tickets/ticket-scan-payload.util';

export type ValidateReason =
  | 'ALREADY_SCANNED'
  | 'WRONG_EVENT'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_SESSION'
  | 'TICKET_VOID';

export type ValidateResult =
  | { valid: true; firstName: string; tier: string }
  | { valid: false; reason: ValidateReason };

@Injectable()
export class ScanService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  private signingSecret(): string {
    return (
      this.configService.get<string>('TICKET_QR_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'fallback-secret'
    );
  }

  private timingSafeEqual(a: string, b: string): boolean {
    try {
      const ba = Buffer.from(a, 'hex');
      const bb = Buffer.from(b, 'hex');
      if (ba.length !== bb.length || ba.length === 0) return false;
      return crypto.timingSafeEqual(ba, bb);
    } catch {
      return false;
    }
  }

  async validate(
    qrPayload: string,
    sessionId: string,
    eventId: string,
  ): Promise<ValidateResult> {
    const parsed = parseTicketScanPayload(qrPayload);
    if (!parsed) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }

    const { ticketId, qrNonce } = parsed;

    return this.dataSource.transaction(async (em) => {
      const ticket = await em.findOne(Ticket, {
        where: { id: ticketId },
        relations: ['order', 'order.event', 'ticketType'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!ticket) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      if (!ticket.qrNonce || qrNonce !== ticket.qrNonce) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      const expectedSig = crypto
        .createHmac('sha256', this.signingSecret())
        .update(`${ticket.id}:${qrNonce}`)
        .digest('hex');

      if (!this.timingSafeEqual(expectedSig, ticket.qrSignature)) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      if (ticket.order?.status !== OrderStatus.PAID) {
        return { valid: false, reason: 'INVALID_SIGNATURE' };
      }

      if (ticket.order?.eventId !== eventId) {
        return { valid: false, reason: 'WRONG_EVENT' };
      }

      if (ticket.status === TicketStatus.VOID) {
        return { valid: false, reason: 'TICKET_VOID' };
      }

      if (ticket.status === TicketStatus.CHECKED_IN) {
        return { valid: false, reason: 'ALREADY_SCANNED' };
      }

      // Atomic update with optimistic concurrency check
      const result = await em
        .createQueryBuilder()
        .update(Ticket)
        .set({ status: TicketStatus.CHECKED_IN })
        .where('id = :id', { id: ticket.id })
        .andWhere('status = :st', { st: TicketStatus.ISSUED })
        .execute();

      if ((result.affected ?? 0) === 0) {
        // Another concurrent scan won the race
        return { valid: false, reason: 'ALREADY_SCANNED' };
      }

      await em.getRepository(CheckIn).insert({
        ticketId: ticket.id,
        scannerSessionId: sessionId,
        occurredAt: new Date(),
      });

      const firstName =
        ticket.attendeeName?.split(' ')[0]?.trim() || 'Guest';
      const tier = ticket.ticketType?.name || 'Ticket';

      return { valid: true, firstName, tier };
    });
  }

  async getSessionInfo(
    sessionId: string,
  ): Promise<{ label: string; eventTitle: string; expiresAt: string }> {
    const session = await this.dataSource
      .getRepository(ScannerSession)
      .findOne({
        where: { id: sessionId },
        relations: ['event'],
      });

    if (!session) {
      return { label: 'Unknown', eventTitle: 'Unknown Event', expiresAt: '' };
    }

    return {
      label: session.label,
      eventTitle: session.event?.title ?? 'Event',
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
