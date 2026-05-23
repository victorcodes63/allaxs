"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";
import { EventStatus } from "@/lib/validation/event";

interface CalEvent {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  venue?: string;
  bannerUrl?: string | null;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfCalendarGrid(year: number, month: number): Date {
  const first = startOfMonth(year, month);
  const offset = first.getDay();
  const grid = new Date(first);
  grid.setDate(first.getDate() - offset);
  return grid;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function statusDot(status: string): string {
  switch (status) {
    case EventStatus.PUBLISHED:
      return "bg-emerald-500";
    case EventStatus.APPROVED:
      return "bg-sky-500";
    case EventStatus.PENDING_REVIEW:
      return "bg-amber-500";
    case EventStatus.REJECTED:
      return "bg-red-500";
    case EventStatus.ARCHIVED:
      return "bg-zinc-500";
    case EventStatus.DRAFT:
    default:
      return "bg-foreground/40";
  }
}

export default function OrganizerCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/events");
      setEvents(normalizeOrganizerEventsListPayload<CalEvent>(res.data));
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gridDays = useMemo(() => {
    const start = startOfCalendarGrid(year, month);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [year, month]);

  const eventsByDay = useMemo(() => {
    const out = new Map<string, CalEvent[]>();
    for (const evt of events) {
      const start = new Date(evt.startAt);
      if (Number.isNaN(start.getTime())) continue;
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const list = out.get(key) ?? [];
      list.push(evt);
      out.set(key, list);
    }
    return out;
  }, [events]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };
  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Calendar
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Month view of your events. Color follows status — published shows are
          live on discovery, approved are awaiting your publish click, drafts are
          not yet visible.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={goPrev}
          >
            ← Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={goToday}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={goNext}
          >
            Next →
          </Button>
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </h2>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface/40">
        <div className="grid grid-cols-7 border-b border-border bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-border">
          {gridDays.map((day, idx) => {
            const inMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            return (
              <div
                key={idx}
                className={`min-h-[6rem] border-t border-border p-2 text-xs sm:min-h-[7.5rem] ${
                  inMonth ? "bg-background/40" : "bg-surface/40"
                }`}
              >
                <div
                  className={`mb-1 flex items-center justify-between text-[11px] tabular-nums ${
                    inMonth ? "text-foreground" : "text-muted"
                  }`}
                >
                  <span
                    className={`${
                      isToday
                        ? "rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white"
                        : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 ? (
                    <span className="text-[10px] text-muted tabular-nums">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <li key={evt.id}>
                      <Link
                        href={`/organizer/events/${evt.id}/edit`}
                        className="group block truncate rounded-md border border-border/60 bg-surface/80 px-1.5 py-1 text-[11px] leading-tight hover:border-primary/40"
                        title={`${evt.title} — ${evt.status.replace(/_/g, " ")}`}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(evt.status)}`}
                            aria-hidden
                          />
                          <span className="truncate group-hover:text-primary">{evt.title}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {dayEvents.length > 3 ? (
                    <li className="text-[10px] text-muted">
                      +{dayEvents.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="legend-heading">
        <h3
          id="legend-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Legend
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            EventStatus.PUBLISHED,
            EventStatus.APPROVED,
            EventStatus.PENDING_REVIEW,
            EventStatus.DRAFT,
            EventStatus.REJECTED,
            EventStatus.ARCHIVED,
          ].map((status) => (
            <span
              key={status}
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(status)}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} aria-hidden />
              {status.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
