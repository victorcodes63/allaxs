"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { findTicketById, loadOrderSnapshot, type StoredTicket } from "@/lib/checkout-storage";
import { buildTicketQrUrl } from "@/lib/ticket-qr";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { normalizeApiTicketPayload } from "@/lib/tickets-api";
import type { PublicEvent } from "@/lib/types/public-event";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { downloadTicketPdf } from "@/lib/ticket-pdf";

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

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
    if (ticket === undefined || ticket === null || !origin) return "";
    return buildTicketQrUrl(origin, ticket);
  }, [ticket, origin]);

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
  const hasEventMeta = Boolean(whenLine || venueLine || organizerName);

  const downloadPdf = async () => {
    if (!ticket || !qrValue) return;
    if (typeof window === "undefined") return;
    setPdfError(null);
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf(
        {
          headline,
          tierName: ticket.tierName,
          attendeeEmail: ticket.attendeeEmail,
          ticketId: ticket.id,
          issuedAtLabel: issued,
          qrPayload: qrValue,
          whenLine,
          venueLine,
          organizerName: organizerName ?? null,
          formatChip,
        },
        { origin: window.location.origin }
      );
    } catch {
      setPdfError("Could not generate PDF right now. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="axs-content-inner mx-auto max-w-2xl space-y-5 pb-16 pt-2 sm:space-y-6 sm:pb-20 md:pt-4">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary transition-colors"
      >
        <span aria-hidden className="text-base leading-none">
          ←
        </span>
        My tickets
      </Link>

      <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_16px_46px_-22px_rgba(0,0,0,0.25),0_6px_20px_-10px_rgba(0,0,0,0.2)]">
        <div className="lg:grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden border-b border-border/80 bg-[#080a14] px-5 py-7 text-white sm:px-7 sm:py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-border/70 lg:py-10">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 70% at 42% -5%, rgba(240,114,65,0.44), transparent 56%), radial-gradient(75% 55% at 100% 95%, rgba(96,24,72,0.24), transparent 58%), linear-gradient(180deg, rgba(7,11,28,0.95), rgba(6,9,20,0.98))",
              }}
              aria-hidden
            />
            <div className="relative space-y-6">
              <div className="space-y-2.5 text-center lg:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">All AXS</p>
                  {formatChip ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                      {formatChip}
                    </span>
                  ) : null}
                </div>
                <h1 className="font-display text-[1.45rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.8rem] md:text-[2rem]">
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

              {hasEventMeta ? (
                <ul className="space-y-4 rounded-[var(--radius-card)] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  {whenLine ? (
                    <li className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">When</p>
                      <p className="text-sm font-medium leading-snug text-white/92">{whenLine}</p>
                    </li>
                  ) : null}
                  {venueLine ? (
                    <li className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Where</p>
                      <p className="text-sm leading-snug text-white/86">{venueLine}</p>
                    </li>
                  ) : null}
                  {organizerName ? (
                    <li className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Host</p>
                      <p className="text-sm font-medium leading-snug text-white/92">{organizerName}</p>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-8 lg:py-10">
            <div className="mx-auto max-w-[272px] text-center sm:max-w-[300px]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Entry code</p>
              <div
                className="mt-3 rounded-[var(--radius-card)] bg-gradient-to-b from-white to-neutral-50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(0,0,0,0.06),0_8px_28px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.06] sm:p-5"
                aria-label="Ticket QR code"
              >
                <QRCode
                  value={qrValue}
                  size={220}
                  level="M"
                  className="h-auto w-full"
                  title="Ticket entry QR code"
                />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Scan with your phone camera to open your pass, or show this code at the door for staff to verify.
              </p>
            </div>
          </section>
        </div>

        <div className="border-t border-border/70 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 md:px-8 md:pb-9 md:pt-6">
          <dl className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-border/75 bg-background/35 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Attendee email</dt>
              <dd className="mt-1.5 text-sm font-medium leading-relaxed text-foreground break-all">{ticket.attendeeEmail}</dd>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border/75 bg-background/35 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Issued</dt>
              <dd className="mt-1.5 text-sm tabular-nums font-medium leading-relaxed text-foreground">{issued}</dd>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border/75 bg-background/35 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Pass id</dt>
              <dd className="mt-1.5 font-mono text-[11px] leading-relaxed text-foreground break-all">{ticket.id}</dd>
            </div>
          </dl>
        </div>
      </article>

      <div className="flex flex-col items-stretch gap-3 sm:items-center sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={downloadingPdf}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 disabled:opacity-70"
        >
          {downloadingPdf ? "Generating PDF..." : "Download PDF ticket"}
        </button>
        {eventSlugForLink ? (
          <ArrowCtaLink
            href={`/e/${eventSlugForLink}`}
            variant="primary"
            className="min-h-11 justify-center px-5 sm:min-w-[200px]"
          >
            View event page
          </ArrowCtaLink>
        ) : (
          <p className="text-center text-sm text-muted max-w-sm">
            Public event link isn&apos;t available for this pass. Your QR above is still valid on this device.
          </p>
        )}
      </div>
      {pdfError ? <p className="text-center text-sm text-primary">{pdfError}</p> : null}
    </div>
  );
}
