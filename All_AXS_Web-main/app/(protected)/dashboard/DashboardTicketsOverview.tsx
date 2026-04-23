"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAllTickets, type StoredTicket } from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { mergeTicketsById, normalizeApiTicketsPayload } from "@/lib/tickets-api";

export function DashboardTicketsOverview() {
  const [tickets, setTickets] = useState<StoredTicket[] | null>(null);

  useEffect(() => {
    if (!isApiCheckoutEnabled()) {
      setTickets(loadAllTickets());
      return;
    }
    let cancelled = false;
    void (async () => {
      const session = loadAllTickets();
      try {
        const res = await fetch("/api/tickets/me", { credentials: "same-origin" });
        if (!res.ok) {
          if (!cancelled) setTickets(session);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setTickets(mergeTicketsById(normalizeApiTicketsPayload(data), session));
      } catch {
        if (!cancelled) setTickets(session);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tickets === null) {
    return (
      <section
        aria-labelledby="dash-tickets-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
      >
        <h3
          id="dash-tickets-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Your passes
        </h3>
        <p className="mt-3 text-sm text-muted">Loading your passes…</p>
      </section>
    );
  }

  if (tickets.length === 0) {
    return (
      <section
        aria-labelledby="dash-tickets-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
      >
        <h3
          id="dash-tickets-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Your passes
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          No passes yet. Browse live listings and complete checkout to add QR entry codes here.
        </p>
        <div className="mt-4">
          <Link
            href="/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-5 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
          >
            Browse events
          </Link>
        </div>
      </section>
    );
  }

  const preview = tickets.slice(0, 4);

  return (
    <section
      aria-labelledby="dash-tickets-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h3
          id="dash-tickets-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Your passes
        </h3>
        <Link
          href="/tickets"
          className="text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
        >
          View all in wallet →
        </Link>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {preview.map((t) => (
          <li key={t.id}>
            <Link
              href={`/tickets/${t.id}`}
              className="flex flex-col rounded-[var(--radius-card)] border border-border bg-background p-4 transition-all hover:border-primary/35 hover:shadow-md"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Pass</p>
              <p className="mt-1 font-display font-semibold text-foreground line-clamp-2">{t.eventTitle}</p>
              <p className="mt-1 text-xs text-muted">{t.tierName}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
