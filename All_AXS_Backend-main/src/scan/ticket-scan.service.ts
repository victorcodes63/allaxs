import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Ticket } from '../domain/ticket.entity';
import { CheckIn } from '../domain/checkin.entity';
import { OrganizerProfile } from '../users/entities/organizer-profile.entity';
import { OrderStatus, TicketStatus } from '../domain/enums';
import type { ScanTicketActionDto } from './dto/scan-ticket.dto';

export type ScanTicketCode =
  | 'OK'
  | 'ALREADY_CHECKED_IN'
  | 'INVALID_PAYLOAD'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN_TICKET'
  | 'ORDER_NOT_PAID'
  | 'VOID_TICKET'
  | 'FORBIDDEN_EVENT';

export type ScanTicketResponse = {
  ok: boolean;
  code: ScanTicketCode;
  message: string;
  ticket?: {
    id: string;
    status: TicketStatus;
    eventId: string;
    eventTitle: string;
    eventSlug: string;
    tierName: string;
    attendeeEmail: string;
    attendeeName: string;
  };
};

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

@Injectable()
export class TicketScanService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(OrganizerProfile)
    private readonly organizerProfileRepository: Repository<OrganizerProfile>,
  ) {}

  private signingSecret(): string {
    return (
      this.configService.get<string>('TICKET_QR_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'fallback-secret'
    );
  }

  private expectedSignature(ticketId: string, qrNonce: string): string {
    return crypto
      .createHmac('sha256', this.signingSecret())
      .update(`${ticketId}:${qrNonce}`)
      .digest('hex');
  }

  private timingSafeEqualHex(a: string, b: string): boolean {
    if (!a || !b || a.length !== b.length) return false;
    try {
      const ba = Buffer.from(a, 'hex');
      const bb = Buffer.from(b, 'hex');
      if (ba.length !== bb.length) return false;
      return crypto.timingSafeEqual(ba, bb);
    } catch {
      return false;
    }
  }

  private parsePayload(
    raw: string,
  ): { ticketId: string; qrNonce: string; qrSignature: string } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const ticketId = pickStr(obj, ['ticketId', 'ticket_id']);
      const qrNonce = pickStr(obj, ['qrNonce', 'qr_nonce']);
      const qrSignature = pickStr(obj, ['qrSignature', 'qr_signature']);
      if (!isUuid(ticketId) || !qrNonce || !qrSignature) return null;
      return { ticketId, qrNonce, qrSignature };
    } catch {
      return null;
    }
  }

  private toPublic(t: Ticket): NonNullable<ScanTicketResponse['ticket']> {
    return {
      id: t.id,
      status: t.status,
      eventId: t.order?.eventId ?? '',
      eventTitle: t.order?.event?.title ?? 'Event',
      eventSlug: t.order?.event?.slug ?? '',
      tierName: t.ticketType?.name ?? 'Ticket',
      attendeeEmail: t.attendeeEmail ?? '',
      attendeeName: (t.attendeeName ?? '').trim(),
    };
  }

  async scanForAdmin(
    actorUserId: string,
    payload: string,
    action: ScanTicketActionDto,
    gateId?: string,
    deviceId?: string,
  ): Promise<ScanTicketResponse> {
    return this.scan(actorUserId, payload, action, 'ADMIN', gateId, deviceId);
  }

  async scanForOrganizer(
    actorUserId: string,
    payload: string,
    action: ScanTicketActionDto,
    gateId?: string,
    deviceId?: string,
  ): Promise<ScanTicketResponse> {
    return this.scan(actorUserId, payload, action, 'ORGANIZER', gateId, deviceId);
  }

  private async scan(
    actorUserId: string,
    rawPayload: string,
    action: ScanTicketActionDto,
    scope: 'ADMIN' | 'ORGANIZER',
    gateId?: string,
    deviceId?: string,
  ): Promise<ScanTicketResponse> {
    const parsed = this.parsePayload(rawPayload);
    if (!parsed) {
      return {
        ok: false,
        code: 'INVALID_PAYLOAD',
        message: 'Unrecognized QR payload. Paste the JSON from the ticket or email.',
      };
    }

    const t = await this.ticketRepository.findOne({
      where: { id: parsed.ticketId },
      relations: ['order', 'order.event', 'order.event.organizer', 'ticketType'],
    });
    if (!t || !t.order?.event) {
      return { ok: false, code: 'UNKNOWN_TICKET', message: 'Ticket not found.' };
    }

    if (parsed.qrNonce !== t.qrNonce) {
      return { ok: false, code: 'INVALID_SIGNATURE', message: 'Invalid ticket.' };
    }

    const expected = this.expectedSignature(t.id, t.qrNonce);
    if (!this.timingSafeEqualHex(expected, parsed.qrSignature)) {
      return {
        ok: false,
        code: 'INVALID_SIGNATURE',
        message: 'Invalid ticket signature.',
      };
    }

    if (scope === 'ORGANIZER') {
      const profile = await this.organizerProfileRepository.findOne({
        where: { userId: actorUserId },
      });
      if (!profile) {
        return {
          ok: false,
          code: 'FORBIDDEN_EVENT',
          message: 'Organizer profile required.',
        };
      }
      const orgId = t.order.event.organizer?.id;
      if (!orgId || orgId !== profile.id) {
        return {
          ok: false,
          code: 'FORBIDDEN_EVENT',
          message: 'This ticket is not for your events.',
        };
      }
    }

    if (t.order.status !== OrderStatus.PAID) {
      return {
        ok: false,
        code: 'ORDER_NOT_PAID',
        message: 'Order is not paid; ticket cannot be used.',
      };
    }

    if (t.status === TicketStatus.VOID) {
      return { ok: false, code: 'VOID_TICKET', message: 'Ticket has been voided.' };
    }

    if (t.status === TicketStatus.CHECKED_IN) {
      return {
        ok: true,
        code: 'ALREADY_CHECKED_IN',
        message: 'Already checked in.',
        ticket: this.toPublic(t),
      };
    }

    if (t.status !== TicketStatus.ISSUED) {
      return {
        ok: false,
        code: 'UNKNOWN_TICKET',
        message: `Unexpected ticket status: ${String(t.status)}.`,
      };
    }

    if (action === 'VERIFY') {
      return {
        ok: true,
        code: 'OK',
        message: 'Ticket is valid.',
        ticket: this.toPublic(t),
      };
    }

    return this.dataSource.transaction(async (em) => {
      const res = await em
        .createQueryBuilder()
        .update(Ticket)
        .set({ status: TicketStatus.CHECKED_IN })
        .where('id = :id', { id: t.id })
        .andWhere('status = :st', { st: TicketStatus.ISSUED })
        .execute();

      const affected = res.affected ?? 0;
      if (affected === 0) {
        const again = await em.findOne(Ticket, {
          where: { id: t.id },
          relations: ['order', 'order.event', 'order.event.organizer', 'ticketType'],
        });
        if (again?.status === TicketStatus.CHECKED_IN) {
          return {
            ok: true,
            code: 'ALREADY_CHECKED_IN',
            message: 'Already checked in.',
            ticket: this.toPublic(again),
          };
        }
        return {
          ok: false,
          code: 'UNKNOWN_TICKET',
          message: 'Unable to complete check-in.',
        };
      }

      const gate = gateId?.trim().slice(0, 64) || undefined;
      const device = deviceId?.trim().slice(0, 64) || undefined;
      await em.getRepository(CheckIn).insert({
        ticketId: t.id,
        operatorId: actorUserId || null,
        ...(gate !== undefined ? { gateId: gate } : {}),
        ...(device !== undefined ? { deviceId: device } : {}),
      });

      const fresh = await em.findOne(Ticket, {
        where: { id: t.id },
        relations: ['order', 'order.event', 'order.event.organizer', 'ticketType'],
      });
      if (!fresh) {
        return {
          ok: false,
          code: 'UNKNOWN_TICKET',
          message: 'Ticket disappeared after check-in.',
        };
      }
      return {
        ok: true,
        code: 'OK',
        message: 'Checked in.',
        ticket: this.toPublic(fresh),
      };
    });
  }
}
