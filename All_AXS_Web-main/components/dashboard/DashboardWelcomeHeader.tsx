"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadAllTickets, type StoredTicket } from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { mergeTicketsById, normalizeApiTicketsPayload } from "@/lib/tickets-api";
import { nextUpcomingTicket } from "@/lib/tickets-grouping";

function formatCountdown(startIso: string): string | null {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return null;
  const diffMs = start - Date.now();
  if (diffMs <= 0) return "Starting soon";
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} to go`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} to go`;
  const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
  return `${mins} min to go`;
}

export function DashboardWelcomeHeader() {
  const { user } = useAuth();
  const [nextTicket, setNextTicket] = useState<StoredTicket | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const session = loadAllTickets();
      if (!isApiCheckoutEnabled()) {
        if (!cancelled) setNextTicket(nextUpcomingTicket(session));
        return;
      }
      try {
        const res = await fetch("/api/tickets/me", { credentials: "same-origin" });
        if (!res.ok) {
          if (!cancelled) setNextTicket(nextUpcomingTicket(session));
          return;
        }
        const data = await res.json();
        const merged = mergeTicketsById(normalizeApiTicketsPayload(data), session);
        if (!cancelled) setNextTicket(nextUpcomingTicket(merged));
      } catch {
        if (!cancelled) setNextTicket(nextUpcomingTicket(session));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  return (
    <header className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        Dashboard home
      </p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            Your fan home for tickets, orders, and discovery. Open a pass for entry codes or browse
            what is live next.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/dashboard/events"
              className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
            >
              Find events
            </Link>
            <Link
              href="/dashboard/orders"
              className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/45"
            >
              My orders
            </Link>
          </div>
        </div>

        {nextTicket ? (
          <Link
            href={`/tickets/${nextTicket.id}`}
            className="w-full rounded-[var(--radius-panel)] border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 lg:max-w-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Next event
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground line-clamp-2">
              {nextTicket.eventTitle || "Your event"}
            </p>
            {nextTicket.eventStartAt ? (
              <p className="mt-1 text-sm text-muted">
                {formatCountdown(nextTicket.eventStartAt)}
              </p>
            ) : null}
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary/90">
              Open pass →
            </p>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
