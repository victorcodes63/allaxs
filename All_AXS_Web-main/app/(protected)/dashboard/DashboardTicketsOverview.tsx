"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAllTickets, type StoredTicket } from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { mergeTicketsById, normalizeApiTicketsPayload } from "@/lib/tickets-api";
import QRCode from "react-qr-code";
import { buildTicketQrUrl } from "@/lib/ticket-qr";

export function DashboardTicketsOverview() {
  const [origin, setOrigin] = useState("");
  const [tickets, setTickets] = useState<StoredTicket[] | null>(() =>
    isApiCheckoutEnabled() ? null : loadAllTickets()
  );

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isApiCheckoutEnabled()) return;
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
            href="/dashboard/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-5 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
          >
            Browse events
          </Link>
        </div>
      </section>
    );
  }

  const featuredPass = tickets[0];
  const extraPasses = tickets.slice(1, 4);
  const featuredQrValue = origin ? buildTicketQrUrl(origin, featuredPass) : "";

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
      <div className="mt-5">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Link
            href={`/tickets/${featuredPass.id}`}
            className="group rounded-[var(--radius-card)] bg-background/35 p-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-primary/35 sm:p-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Featured pass</p>
            <p className="mt-2 font-display text-xl font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {featuredPass.eventTitle || "Your event"}
            </p>
            <p className="mt-1 text-sm text-muted">{featuredPass.tierName}</p>
            <p className="mt-3 text-xs text-muted break-words">{featuredPass.attendeeEmail}</p>
            <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary/90">
              Open pass <span aria-hidden>→</span>
            </p>
          </Link>

          <Link
            href={`/tickets/${featuredPass.id}`}
            className="rounded-[var(--radius-card)] bg-background/35 p-4 text-center shadow-[0_16px_40px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-primary/35 sm:p-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Entry code</p>
            <div className="mx-auto mt-3 w-full max-w-[180px] rounded-[var(--radius-card)] bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_0_0_1px_rgba(0,0,0,0.06)]">
              <QRCode value={featuredQrValue} size={156} level="M" className="h-auto w-full" />
            </div>
            <p className="mt-3 text-xs text-muted">Tap to open full pass and scanner details.</p>
          </Link>
        </div>

        {extraPasses.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extraPasses.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className="flex h-full flex-col rounded-[var(--radius-card)] bg-background/30 p-3.5 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:ring-primary/35"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Pass</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{t.eventTitle || "Your event"}</p>
                  <p className="mt-1 text-xs text-muted">{t.tierName}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
