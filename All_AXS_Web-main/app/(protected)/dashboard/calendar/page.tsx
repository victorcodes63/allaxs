"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredTicket } from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { normalizeApiTicketsPayload } from "@/lib/tickets-api";
import { splitTicketsByTime } from "@/lib/tickets-grouping";
import { CalendarEventRowActions } from "@/components/dashboard/CalendarEventRowActions";

type CalendarEntry = {
  key: string;
  eventTitle: string;
  eventSlug: string;
  eventStartAt: string;
  eventEndAt?: string;
  venue?: string;
  city?: string;
  ticketId: string;
};

function formatWhen(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return "Date TBA";
    const startLabel = start.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!endIso) return startLabel;
    const end = new Date(endIso);
    if (Number.isNaN(end.getTime())) return startLabel;
    if (start.toDateString() === end.toDateString()) {
      return `${startLabel} – ${end.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return `${startLabel} – ${end.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Date TBA";
  }
}

function formatDateGroupHeader(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Upcoming";
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Upcoming";
  }
}

function dedupeTicketsForCalendar(tickets: StoredTicket[]): CalendarEntry[] {
  const map = new Map<string, CalendarEntry>();
  for (const ticket of tickets) {
    const key =
      ticket.eventSlug?.trim() ||
      ticket.eventId?.trim() ||
      `${ticket.eventTitle}-${ticket.eventStartAt ?? ""}`;
    if (!key) continue;
    if (map.has(key)) continue;
    map.set(key, {
      key,
      eventTitle: ticket.eventTitle?.trim() || "Your event",
      eventSlug: ticket.eventSlug?.trim() || "",
      eventStartAt: ticket.eventStartAt ?? "",
      eventEndAt: ticket.eventEndAt,
      venue: ticket.eventVenue,
      city: ticket.eventCity,
      ticketId: ticket.id,
    });
  }
  return [...map.values()].sort((a, b) => {
    const ta = a.eventStartAt ? new Date(a.eventStartAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.eventStartAt ? new Date(b.eventStartAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
}

function groupByDate(entries: CalendarEntry[]): { dateLabel: string; items: CalendarEntry[] }[] {
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const label = entry.eventStartAt
      ? formatDateGroupHeader(entry.eventStartAt)
      : "Date to be announced";
    const list = groups.get(label) ?? [];
    list.push(entry);
    groups.set(label, list);
  }
  return [...groups.entries()].map(([dateLabel, items]) => ({ dateLabel, items }));
}

export default function FanCalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiCheckout = isApiCheckoutEnabled();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/tickets/me", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { message?: string }).message || "Could not load your events.");
        setEntries([]);
        return;
      }
      const tickets = normalizeApiTicketsPayload(data);
      const { upcoming, unknown } = splitTicketsByTime(tickets);
      setEntries(dedupeTicketsForCalendar([...upcoming, ...unknown]));
    } catch {
      setError("Could not load your events.");
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => (entries ? groupByDate(entries) : []), [entries]);

  if (!apiCheckout) {
    return (
      <div className="space-y-4 pb-12">
        <header className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Schedule</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My calendar
          </h1>
        </header>
        <p className="text-sm text-muted">
          Your event calendar is available when API checkout is enabled for this environment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Schedule</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          My calendar
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Upcoming events from your passes, grouped by date. Add any show to your personal calendar
          or jump straight to your ticket.
        </p>
      </header>

      {entries === null ? (
        <p className="text-sm text-muted">Loading your schedule…</p>
      ) : error ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-5 py-4 text-sm text-muted">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
          <p className="text-lg text-muted">No upcoming events on your calendar.</p>
          <p className="text-sm text-muted">
            When you buy passes, they will appear here with quick links to add them to your calendar.
          </p>
          <Link
            href="/dashboard/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ dateLabel, items }) => (
            <section key={dateLabel} aria-labelledby={`cal-${dateLabel}`}>
              <h2
                id={`cal-${dateLabel}`}
                className="text-xs font-bold uppercase tracking-[0.14em] text-primary"
              >
                {dateLabel}
              </h2>
              <ul className="mt-4 grid gap-4">
                {items.map((entry) => {
                  const venueLine = [entry.venue, entry.city].filter(Boolean).join(" · ");
                  const eventUrl = entry.eventSlug
                    ? `/dashboard/events/${entry.eventSlug}`
                    : null;
                  return (
                    <li
                      key={entry.key}
                      className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="font-display text-lg font-semibold text-foreground line-clamp-2">
                            {entry.eventTitle}
                          </p>
                          <p className="text-sm text-muted">
                            {entry.eventStartAt
                              ? formatWhen(entry.eventStartAt, entry.eventEndAt)
                              : "Date to be announced"}
                          </p>
                          {venueLine ? (
                            <p className="text-sm text-foreground/80">{venueLine}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 lg:max-w-md lg:text-right">
                          <CalendarEventRowActions
                            title={entry.eventTitle}
                            startIso={entry.eventStartAt || new Date().toISOString()}
                            endIso={entry.eventEndAt}
                            location={venueLine || undefined}
                            ticketId={entry.ticketId}
                            eventUrl={eventUrl}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
