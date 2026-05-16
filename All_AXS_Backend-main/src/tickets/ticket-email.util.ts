import { Event } from '../events/entities/event.entity';
import { EventType } from '../domain/enums';
import { Ticket } from '../domain/ticket.entity';
import type { TicketPdfContent } from './ticket-pdf.service';

export type TicketEmailTicketInput = {
  id: string;
  tierName: string;
  qrNonce: string;
  qrSignature: string;
  issuedAt: Date;
};

export type TicketEmailEventInput = {
  title: string;
  slug?: string;
  startAt?: Date;
  endAt?: Date;
  venue?: string | null;
  city?: string | null;
  country?: string | null;
  type?: EventType;
  organizerName?: string | null;
};

function eventTypeLabel(type: EventType): string {
  switch (type) {
    case EventType.IN_PERSON:
      return 'In person';
    case EventType.VIRTUAL:
      return 'Virtual';
    case EventType.HYBRID:
      return 'Hybrid';
    default:
      return type;
  }
}

function formatEventWhen(start: Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(start);
}

function formatEventRange(start: Date, end: Date): string {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    const date = new Intl.DateTimeFormat('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(start);
    const t = new Intl.DateTimeFormat('en-KE', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${date} · ${t.format(start)} – ${t.format(end)}`;
  }
  return `${formatEventWhen(start)} – ${formatEventWhen(end)}`;
}

export function eventToEmailContext(
  event: Event | null | undefined,
  organizerName?: string | null,
): TicketEmailEventInput | undefined {
  if (!event) return undefined;
  return {
    title: event.title,
    slug: event.slug,
    startAt: event.startAt,
    endAt: event.endAt,
    venue: event.venue,
    city: event.city,
    country: event.country,
    type: event.type,
    organizerName: organizerName ?? event.organizer?.orgName ?? null,
  };
}

export function ticketToPdfContent(
  ticket: TicketEmailTicketInput,
  event: TicketEmailEventInput | undefined,
  buyerEmail: string,
): TicketPdfContent {
  const whenLine =
    event?.startAt && event?.endAt
      ? formatEventRange(event.startAt, event.endAt)
      : event?.startAt
        ? formatEventWhen(event.startAt)
        : null;

  const venueLine =
    [event?.venue, event?.city, event?.country].filter(Boolean).join(' · ') ||
    null;

  const issuedAtLabel = new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ticket.issuedAt);

  return {
    headline: event?.title ?? 'Your event',
    tierName: ticket.tierName,
    attendeeEmail: buyerEmail,
    ticketId: ticket.id,
    issuedAtLabel,
    qrNonce: ticket.qrNonce,
    qrSignature: ticket.qrSignature,
    whenLine,
    venueLine,
    organizerName: event?.organizerName ?? null,
    formatChip: event?.type ? eventTypeLabel(event.type) : null,
  };
}

export function ticketsFromEntities(
  tickets: Ticket[],
  tierName: (t: Ticket) => string,
): TicketEmailTicketInput[] {
  return tickets.map((t) => ({
    id: t.id,
    tierName: tierName(t),
    qrNonce: t.qrNonce,
    qrSignature: t.qrSignature,
    issuedAt: t.createdAt,
  }));
}
