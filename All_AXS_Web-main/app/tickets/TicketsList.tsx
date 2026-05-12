"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAllTickets, type StoredTicket } from "@/lib/checkout-storage";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { mergeTicketsById, normalizeApiTicketsPayload } from "@/lib/tickets-api";

function formatTicketWhen(startIso?: string, endIso?: string): string | null {
  if (!startIso) return null;
  try {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return null;
    const startLabel = start.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!endIso) return startLabel;
    const end = new Date(endIso);
    if (Number.isNaN(end.getTime())) return startLabel;
    if (start.toDateString() === end.toDateString()) {
      return `${startLabel} - ${end.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return `${startLabel} - ${end.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return null;
  }
}

function compactTicketRef(id: string): string {
  return id.startsWith("tk_") ? id.slice(3, 11).toUpperCase() : id.slice(0, 8).toUpperCase();
}

export function TicketsList() {
  const [mounted, setMounted] = useState(false);
  const [apiTickets, setApiTickets] = useState<StoredTicket[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted || !isApiCheckoutEnabled()) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tickets/me", { credentials: "same-origin" });
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 401) {
            setApiError("Sign in to load tickets linked to your account.");
          } else {
            setApiError("Could not load tickets from the server.");
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setApiTickets(normalizeApiTicketsPayload(data));
      } catch {
        if (!cancelled) setApiError("Could not load tickets.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  if (!mounted) {
    return <p className="text-muted py-12 text-center">Loading tickets…</p>;
  }

  const sessionTickets = loadAllTickets();
  const tickets: StoredTicket[] = !isApiCheckoutEnabled()
    ? sessionTickets
    : apiError
      ? sessionTickets
      : mergeTicketsById(apiTickets ?? [], sessionTickets);

  const awaitingServerList =
    isApiCheckoutEnabled() && apiTickets === null && !apiError && tickets.length === 0;

  if (awaitingServerList) {
    return <p className="text-muted py-12 text-center">Loading tickets…</p>;
  }

  if (apiError && tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4 max-w-lg mx-auto">
        <p className="text-lg text-muted">{apiError}</p>
        <ArrowCtaLink href="/login" variant="primary">
          Sign in
        </ArrowCtaLink>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4 max-w-lg mx-auto">
        <p className="text-lg text-muted">No tickets yet—complete checkout on a published event.</p>
        <ArrowCtaLink href="/dashboard/events" variant="primary">
          Find an event
        </ArrowCtaLink>
      </div>
    );
  }

  const sessionFallbackBanner =
    isApiCheckoutEnabled() && apiError && tickets.length > 0 ? (
      <div className="rounded-[var(--radius-panel)] border border-border bg-primary/5 px-5 py-4 text-sm text-muted max-w-2xl">
        <p className="font-medium text-foreground">Account passes unavailable</p>
        <p className="mt-1 leading-relaxed">{apiError}</p>
        <p className="mt-2 leading-relaxed">
          You still have demo passes stored in this browser—open each card below for a scannable QR code.
        </p>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {sessionFallbackBanner}
      <ul className="grid gap-4 sm:grid-cols-2">
      {tickets.map((t: StoredTicket) => {
        const whenLabel = formatTicketWhen(t.eventStartAt, t.eventEndAt);
        const locationLabel = [t.eventVenue, t.eventCity].filter(Boolean).join(" · ");
        return (
          <li key={t.id}>
            <Link
              href={`/tickets/${t.id}`}
              className="block rounded-[var(--radius-card)] border border-border bg-surface p-6 hover:border-primary/35 hover:shadow-md transition-all group"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Event pass</p>
              <p className="font-display font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {t.eventTitle?.trim() ? t.eventTitle : "Your event"}
              </p>
              <p className="text-sm text-muted mt-1.5">{t.tierName}</p>
              {whenLabel ? <p className="mt-3 text-sm text-foreground/90">{whenLabel}</p> : null}
              {locationLabel ? <p className="mt-1 text-sm text-muted line-clamp-1">{locationLabel}</p> : null}
              <p className="mt-4 text-[11px] text-muted">
                Ref <span className="font-mono tracking-[0.06em]">{compactTicketRef(t.id)}</span>
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
                  View QR
                </span>
                <span
                  aria-hidden
                  className="text-base leading-none text-primary transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>
            </Link>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
