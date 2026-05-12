"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { EventStatus } from "@/lib/validation/event";
import {
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

type EventStatusKey = (typeof EventStatus)[keyof typeof EventStatus];

interface AdminEventRow {
  id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  status: EventStatusKey;
  startAt: string;
  endAt: string;
  bannerUrl?: string | null;
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  createdAt: string;
  ticketTypes?: Array<{ id: string; name: string }>;
  organizer: {
    id?: string | null;
    orgName: string;
    user?: { id?: string | null; email?: string | null; name?: string | null };
  };
}

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: EventStatus.PENDING_REVIEW, label: "Pending review" },
  { value: EventStatus.PUBLISHED, label: "Live" },
  { value: EventStatus.APPROVED, label: "Approved" },
  { value: EventStatus.DRAFT, label: "Draft" },
  { value: EventStatus.REJECTED, label: "Rejected" },
  { value: EventStatus.ARCHIVED, label: "Archived" },
];

function statusChipClass(status: string): string {
  switch (status) {
    case EventStatus.DRAFT:
      return "border border-white/10 bg-white/[0.06] text-foreground/85";
    case EventStatus.PENDING_REVIEW:
      return "border border-amber-400/25 bg-amber-500/15 text-amber-100";
    case EventStatus.APPROVED:
      return "border border-sky-400/25 bg-sky-500/15 text-sky-100";
    case EventStatus.PUBLISHED:
      return "border border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case EventStatus.REJECTED:
      return "border border-red-400/30 bg-red-500/12 text-red-100";
    case EventStatus.ARCHIVED:
      return "border border-white/10 bg-white/[0.04] text-muted";
    default:
      return "border border-white/10 bg-white/[0.06] text-foreground/80";
  }
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function typeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function AdminEventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus =
    STATUS_FILTERS.find((f) => f.value === searchParams.get("status"))?.value ??
    "all";

  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const qs = params.toString();
      const response = await axios.get<AdminEventRow[]>(
        `/api/admin/events${qs ? `?${qs}` : ""}`,
      );
      setEvents(response.data ?? []);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load events.";
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep URL in sync so the view is shareable + survives refresh.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    const qs = sp.toString();
    router.replace(qs ? `/admin/events?${qs}` : "/admin/events", {
      scroll: false,
    });
  }, [router, statusFilter, debouncedSearch]);

  const counts = useMemo(() => {
    const acc = {
      total: events.length,
      pending: 0,
      live: 0,
      draft: 0,
      rejected: 0,
    };
    for (const event of events) {
      if (event.status === EventStatus.PENDING_REVIEW) acc.pending += 1;
      if (event.status === EventStatus.PUBLISHED) acc.live += 1;
      if (event.status === EventStatus.DRAFT) acc.draft += 1;
      if (event.status === EventStatus.REJECTED) acc.rejected += 1;
    }
    return acc;
  }, [events]);

  return (
    <main className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Admin
          </p>
          <h1 className="mt-1.5 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            All events
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every event on the platform across organisers and statuses. Use
            this view for research; jump into the moderation queue to action
            pending submissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted sm:shrink-0">
          <span className="rounded-full border border-border/70 bg-surface/80 px-3 py-1">
            {counts.total} total
          </span>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
            {counts.pending} pending
          </span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
            {counts.live} live
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-[2]">
          <label
            htmlFor="admin-events-search"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="admin-events-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title, organiser, or email…"
            className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
            aria-label="Search events"
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:flex-none">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.value === statusFilter;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-[border-color,background-color,color] ${
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-surface/80 text-muted hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          {debouncedSearch.trim()
            ? `No events match “${debouncedSearch.trim()}”.`
            : statusFilter === "all"
              ? "No events have been created on the platform yet."
              : `No events with status “${statusFilter.replace(/_/g, " ").toLowerCase()}”.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <AdminEventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </main>
  );
}

/** Compact list-view action — sized for density, not forms. */
const ROW_ACTION_BASE =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
const ROW_ACTION_PRIMARY = `${ROW_ACTION_BASE} border border-primary/55 bg-primary/15 text-primary hover:bg-primary/25 hover:text-foreground`;
const ROW_ACTION_GHOST = `${ROW_ACTION_BASE} border border-transparent text-muted hover:border-border hover:bg-wash/40 hover:text-foreground`;

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3 w-3 shrink-0"
      fill="none"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminEventCard({ event }: { event: AdminEventRow }) {
  const bannerSrc = event.bannerUrl ? getEventBannerUrl(event.bannerUrl) : null;
  const tierCount = event.ticketTypes?.length ?? 0;
  const isPending = event.status === EventStatus.PENDING_REVIEW;
  const isLive = event.status === EventStatus.PUBLISHED;
  const venueLine =
    [event.venue, event.city, event.country].filter(Boolean).join(" · ") ||
    null;

  return (
    <li className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border bg-surface/85 p-4 transition-[border-color,box-shadow] hover:border-primary/30 sm:flex-row sm:items-start sm:p-5">
      <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-[var(--radius-panel)] border border-border/70 bg-wash sm:h-24 sm:w-40">
        {bannerSrc ? (
          <Image
            src={bannerSrc}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 639px) 92vw, 160px"
            unoptimized={shouldUnoptimizeEventImage(bannerSrc)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-muted">
            No banner
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 min-w-0 font-display text-base font-semibold leading-snug tracking-tight text-foreground sm:line-clamp-1 sm:truncate sm:text-lg">
            {event.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(event.status)}`}
          >
            {event.status.replace(/_/g, " ")}
          </span>
          <span className="shrink-0 rounded-full border border-border/70 bg-wash/60 px-2 py-0.5 text-[10px] font-medium text-muted">
            {typeLabel(event.type)}
          </span>
        </div>
        <p className="text-xs text-muted">
          <span className="font-medium text-foreground/85">
            {event.organizer.orgName}
          </span>
          {event.organizer.user?.email ? (
            <span className="text-muted/70">
              {" "}
              · {event.organizer.user.email}
            </span>
          ) : null}
        </p>
        <div className="grid grid-cols-1 gap-1 text-xs text-muted tabular-nums sm:grid-cols-2">
          <p>Starts {formatDate(event.startAt)}</p>
          <p>Ends {formatDate(event.endAt)}</p>
          <p>
            {tierCount} ticket tier{tierCount === 1 ? "" : "s"}
          </p>
          <p>Submitted {formatDate(event.createdAt)}</p>
        </div>
        {venueLine ? (
          <p className="text-xs text-muted">{venueLine}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-1.5 sm:items-end sm:justify-end sm:self-center">
        {isPending ? (
          <Link
            href={`/admin/moderation?search=${encodeURIComponent(event.title)}`}
            className={ROW_ACTION_PRIMARY}
          >
            Review
            <ArrowIcon />
          </Link>
        ) : null}
        {isLive && event.slug ? (
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener"
            className={ROW_ACTION_GHOST}
          >
            View live
            <ArrowIcon />
          </Link>
        ) : null}
        <Link
          href={`/admin/events/${event.id}`}
          className={ROW_ACTION_GHOST}
          aria-label={`Inspect ${event.title}`}
        >
          Inspect
        </Link>
      </div>
    </li>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense
      fallback={
        <main
          className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
        >
          <p className="text-sm text-muted">Loading events…</p>
        </main>
      }
    >
      <AdminEventsPageContent />
    </Suspense>
  );
}
