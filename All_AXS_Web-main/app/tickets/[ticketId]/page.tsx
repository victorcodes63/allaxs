"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { findTicketById, loadOrderSnapshot, type StoredTicket } from "@/lib/checkout-storage";
import { buildTicketQrPayload } from "@/lib/ticket-qr";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { normalizeApiTicketPayload } from "@/lib/tickets-api";
import type { PublicEvent } from "@/lib/types/public-event";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

function formatEventWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function eventTypeLabel(type: PublicEvent["type"]): string {
  switch (type) {
    case "IN_PERSON":
      return "In person";
    case "VIRTUAL":
      return "Virtual";
    case "HYBRID":
      return "Hybrid";
    default:
      return "Event";
  }
}

function formatEventRange(startIso: string, endIso?: string): string {
  const start = formatEventWhen(startIso);
  if (!endIso) return start;
  try {
    const a = new Date(startIso);
    const b = new Date(endIso);
    if (a.toDateString() === b.toDateString()) {
      return `${formatEventWhen(startIso)} – ${b.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return `${formatEventWhen(startIso)} – ${formatEventWhen(endIso)}`;
  } catch {
    return start;
  }
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<StoredTicket | null | undefined>(undefined);
  const [eventDetails, setEventDetails] = useState<PublicEvent | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isApiCheckoutEnabled()) {
      setTicket(findTicketById(ticketId));
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const normalized = normalizeApiTicketPayload(data);
          if (normalized) {
            setTicket(normalized);
            return;
          }
        }
        const local = findTicketById(ticketId);
        setTicket(local);
      } catch {
        if (!cancelled) setTicket(findTicketById(ticketId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  useEffect(() => {
    if (!ticket) {
      setEventDetails(null);
      setEventLoading(false);
      return;
    }
    const orderSnap = ticket.orderId ? loadOrderSnapshot(ticket.orderId) : null;
    const slug = (ticket.eventSlug || orderSnap?.eventSlug || "").trim();
    if (!slug) {
      setEventDetails(null);
      setEventLoading(false);
      return;
    }
    let cancelled = false;
    setEventLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/public/events/by-slug/${encodeURIComponent(slug)}`, {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (!res.ok) {
          setEventDetails(null);
          return;
        }
        const data = (await res.json()) as PublicEvent;
        if (!cancelled) setEventDetails(data);
      } catch {
        if (!cancelled) setEventDetails(null);
      } finally {
        if (!cancelled) setEventLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  const qrValue = useMemo(() => {
    if (ticket === undefined || ticket === null) return "";
    return buildTicketQrPayload(ticket);
  }, [ticket]);

  if (ticket === undefined) {
    return (
      <div className="axs-content-inner max-w-lg mx-auto pb-20 pt-6">
        <div className="h-4 w-28 animate-pulse rounded-md bg-foreground/10" aria-hidden />
        <div className="mt-8 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-sm">
          <div className="h-36 animate-pulse bg-foreground/10" />
          <div className="space-y-4 p-8">
            <div className="mx-auto h-52 w-52 animate-pulse rounded-[var(--radius-card)] bg-foreground/8" />
            <div className="h-3 w-3/4 mx-auto animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-1/2 mx-auto animate-pulse rounded bg-foreground/10" />
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">Loading your pass…</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="axs-content-inner max-w-md mx-auto py-16 md:py-24 text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-card)] border border-border bg-wash text-2xl text-muted">
          ◎
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">Pass not found</h1>
          <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
            This link may be wrong, the pass expired from your browser session, or it belongs to another account.
          </p>
        </div>
        <ArrowCtaLink href="/tickets" variant="outline" className="justify-center">
          Back to My tickets
        </ArrowCtaLink>
      </div>
    );
  }

  const issued = new Date(ticket.issuedAt).toLocaleString();

  const orderSnap = ticket.orderId ? loadOrderSnapshot(ticket.orderId) : null;

  const headline =
    eventDetails?.title ||
    (orderSnap?.eventTitle?.trim() ? orderSnap.eventTitle.trim() : null) ||
    (ticket.eventTitle && ticket.eventTitle !== "Event" ? ticket.eventTitle : null) ||
    "Your pass";

  const eventSlugForLink = (
    eventDetails?.slug ||
    ticket.eventSlug ||
    orderSnap?.eventSlug ||
    ""
  ).trim();

  const whenLine =
    eventDetails?.startAt && eventDetails?.endAt
      ? formatEventRange(eventDetails.startAt, eventDetails.endAt)
      : eventDetails?.startAt
        ? formatEventWhen(eventDetails.startAt)
        : ticket.eventStartAt
          ? ticket.eventEndAt
            ? formatEventRange(ticket.eventStartAt, ticket.eventEndAt)
            : formatEventWhen(ticket.eventStartAt)
          : null;

  const venueLine =
    [eventDetails?.venue, eventDetails?.city, eventDetails?.country].filter(Boolean).join(" · ") ||
    [ticket.eventVenue, ticket.eventCity, ticket.eventCountry].filter(Boolean).join(" · ") ||
    null;

  const organizerName = eventDetails?.organizer?.orgName;
  const formatChip = eventDetails?.type ? eventTypeLabel(eventDetails.type) : null;

  return (
    <div className="axs-content-inner max-w-lg mx-auto pb-20 pt-2 md:pt-4 space-y-8">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors"
      >
        <span aria-hidden className="text-base leading-none">
          ←
        </span>
        My tickets
      </Link>

      <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_12px_40px_-18px_rgba(0,0,0,0.12),0_4px_14px_-6px_rgba(0,0,0,0.06)]">
        <header className="relative bg-foreground px-6 pb-10 pt-9 text-center text-background md:px-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              background:
                "radial-gradient(120% 80% at 50% -20%, rgba(240,114,65,0.55), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(96,24,72,0.35), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">All AXS</p>
              {formatChip ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                  {formatChip}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-3xl">
              {headline}
            </h1>
            <p>
              <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">
                {ticket.tierName}
              </span>
            </p>
            {eventLoading && eventSlugForLink ? (
              <p className="text-xs text-white/55">Syncing event details…</p>
            ) : null}
          </div>
        </header>

        {(whenLine || venueLine || organizerName) && (
          <div className="border-b border-border bg-gradient-to-b from-wash to-background px-6 py-5 md:px-8">
            <ul className="space-y-4 text-sm">
              {whenLine ? (
                <li className="flex gap-3">
                  <span className="shrink-0 w-16 pt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    When
                  </span>
                  <span className="min-w-0 font-medium leading-snug text-foreground">{whenLine}</span>
                </li>
              ) : null}
              {venueLine ? (
                <li className="flex gap-3">
                  <span className="shrink-0 w-16 pt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Where
                  </span>
                  <span className="min-w-0 leading-snug text-foreground">{venueLine}</span>
                </li>
              ) : null}
              {organizerName ? (
                <li className="flex gap-3">
                  <span className="shrink-0 w-16 pt-0.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    Host
                  </span>
                  <span className="min-w-0 font-medium leading-snug text-foreground">{organizerName}</span>
                </li>
              ) : null}
            </ul>
          </div>
        )}

        <div className="px-6 pb-9 pt-8 md:px-10">
          <div className="mx-auto max-w-[280px] text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Entry code</p>
            <div
              className="mt-3 rounded-[var(--radius-card)] bg-gradient-to-b from-white to-neutral-50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(0,0,0,0.06),0_8px_28px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.06]"
              aria-label="Ticket QR code"
            >
              <QRCode value={qrValue} size={216} level="M" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              {isApiCheckoutEnabled()
                ? "This QR includes a server-issued nonce and signature for demo check-in."
                : "Demo mode: payload is JSON your scanners can read for testing."}
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-border divide-y divide-border bg-background/50">
            <div className="flex flex-col gap-0.5 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Attendee email</dt>
              <dd className="text-sm font-medium text-foreground text-right break-all sm:max-w-[60%]">
                {ticket.attendeeEmail}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Issued</dt>
              <dd className="text-sm tabular-nums font-medium text-foreground">{issued}</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted shrink-0">Pass id</dt>
              <dd className="font-mono text-[11px] leading-relaxed text-foreground break-all text-right sm:max-w-[70%]">
                {ticket.id}
              </dd>
            </div>
          </div>
        </div>
      </article>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {eventSlugForLink ? (
          <ArrowCtaLink href={`/e/${eventSlugForLink}`} variant="primary" className="justify-center min-w-[200px]">
            View event page
          </ArrowCtaLink>
        ) : (
          <p className="text-center text-sm text-muted max-w-sm">
            Public event link isn&apos;t available for this pass. Your QR above is still valid on this device.
          </p>
        )}
      </div>
    </div>
  );
}
