"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";
import { getEventBannerUrl, shouldUnoptimizeEventImage } from "@/lib/utils/image";
import { EventStatus } from "@/lib/validation/event";

const ATTENTION_FILTER = "attention";

interface Event {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  venue?: string;
  slug: string;
  bannerUrl?: string | null;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: ATTENTION_FILTER, label: "Attention" },
  { value: EventStatus.DRAFT, label: "Draft" },
  { value: EventStatus.PENDING_REVIEW, label: "In review" },
  { value: EventStatus.APPROVED, label: "Approved" },
  { value: EventStatus.PUBLISHED, label: "Live" },
  { value: EventStatus.REJECTED, label: "Rejected" },
  { value: EventStatus.ARCHIVED, label: "Archived" },
] as const;

function formatEventStatus(status: string): string {
  const match = STATUS_FILTERS.find((item) => item.value === status);
  return match?.label ?? status.replace(/_/g, " ").toLowerCase();
}

function formatEventType(type: Event["type"]): string {
  return type.replace(/_/g, " ").toLowerCase();
}

function EventsListPageContent() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    STATUS_FILTERS.some((filter) => filter.value === requestedStatus)
      ? requestedStatus ?? "all"
      : "all",
  );
  const queryRaw = (searchParams.get("q") ?? "").trim();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/events");
        setEvents(normalizeOrganizerEventsListPayload<Event>(response.data));
        setError(null);
      } catch (err) {
        if (!isAxiosError(err)) {
          setError("Something went wrong while loading your events.");
          return;
        }
        if (err.code === "ERR_NETWORK" || !err.response) {
          setError(
            "Network error — check your connection and try again."
          );
          return;
        }
        const status = err.response.status;
        const serverMessage = (err.response.data as { message?: string })
          ?.message;

        if (status === 401) {
          setError("Your session expired — sign in again to view your events.");
        } else if (status === 403) {
          setError("You do not have permission to view events.");
        } else if (status === 422 || status === 400) {
          setError(serverMessage || "We could not load your events (invalid request).");
        } else {
          setError(serverMessage || "Failed to load events. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    if (!requestedStatus) return;
    if (!STATUS_FILTERS.some((filter) => filter.value === requestedStatus)) return;
    setStatusFilter(requestedStatus);
  }, [requestedStatus]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return events;
    if (statusFilter === ATTENTION_FILTER) {
      return events.filter(
        (event) =>
          event.status === EventStatus.PENDING_REVIEW ||
          event.status === EventStatus.REJECTED,
      );
    }
    return events.filter((event) => event.status === statusFilter);
  }, [events, statusFilter]);

  const filteredEvents = useMemo(() => {
    if (!queryRaw) return filteredByStatus;
    const ql = queryRaw.toLowerCase();
    return filteredByStatus.filter(
      (e) =>
        e.title.toLowerCase().includes(ql) ||
        e.slug.toLowerCase().includes(ql) ||
        (e.venue?.toLowerCase().includes(ql) ?? false),
    );
  }, [filteredByStatus, queryRaw]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    for (const event of events) {
      counts[event.status] = (counts[event.status] ?? 0) + 1;
    }
    return counts;
  }, [events]);

  const draftCount = statusCounts[EventStatus.DRAFT] ?? 0;
  const reviewCount = statusCounts[EventStatus.PENDING_REVIEW] ?? 0;
  const attentionCount = reviewCount + (statusCounts[EventStatus.REJECTED] ?? 0);
  const liveCount = statusCounts[EventStatus.PUBLISHED] ?? 0;
  const missingPosterCount = events.filter(
    (event) =>
      !event.bannerUrl &&
      (event.status === EventStatus.DRAFT ||
        event.status === EventStatus.PENDING_REVIEW),
  ).length;
  const hasEvents = events.length > 0;
  const hasActiveFilters = Boolean(queryRaw || statusFilter !== "all");

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-muted">Loading events…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-primary">{error}</p>
        <Link
          href="/organizer/dashboard"
          className="text-sm text-muted hover:text-foreground"
        >
          Back to overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {queryRaw ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border/80 bg-wash/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Filtering by{" "}
            <span className="font-medium text-foreground">&ldquo;{queryRaw}&rdquo;</span>
            {" — "}
            title, slug, or venue.
          </p>
          <Link
            href="/organizer/events"
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            Clear search
          </Link>
        </div>
      ) : null}
      <div className="flex flex-col gap-5 rounded-[var(--radius-panel)] border border-border bg-surface/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Organizer events
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Manage drafts, reviews, and live listings from one place.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Each event card shows what needs attention next: poster, review status,
            dates, location, and the editor entry point.
          </p>
        </div>
        {hasEvents ? (
          <Link href="/organizer/events/new" className="shrink-0">
            <Button className="w-full sm:w-auto">Create event</Button>
          </Link>
        ) : null}
      </div>

      {hasEvents ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Total events
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
              {events.length}
            </p>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Drafts
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
              {draftCount}
            </p>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              In review
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
              {reviewCount}
            </p>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Live
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-foreground">
              {liveCount}
            </p>
          </div>
        </div>
      ) : null}

      {hasEvents ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" aria-label="Filter events by status">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.value;
              const count =
                filter.value === ATTENTION_FILTER
                  ? attentionCount
                  : statusCounts[filter.value] ?? 0;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[border-color,background-color,color] ${
                    isActive
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                      isActive ? "bg-white/20 text-white" : "bg-wash text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {missingPosterCount > 0 ? (
            <p className="text-sm text-muted">
              {missingPosterCount} editable{" "}
              {missingPosterCount === 1 ? "event is" : "events are"} missing poster art.
              Add one from the media tab so public listings and checkout look complete.
            </p>
          ) : null}
        </div>
      ) : null}

      {filteredEvents.length === 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface/80">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {hasActiveFilters ? "No matches" : "No events yet"}
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground">
                {hasActiveFilters
                  ? "Nothing matches the current view."
                  : "Create the event once, then finish media and tickets in the editor."}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                {hasActiveFilters
                  ? "Try another status or clear the search to see the rest of your organizer events."
                  : "Start with the essentials: title, date, venue, and description. After that, upload the poster and add ticket tiers before submitting for review."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {hasActiveFilters ? (
                  <Link href="/organizer/events" className="sm:w-auto">
                    <Button variant="secondary" className="w-full sm:w-auto">
                      Clear filters
                    </Button>
                  </Link>
                ) : (
                  <Link href="/organizer/events/new" className="sm:w-auto">
                    <Button className="w-full sm:w-auto">Create event</Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="border-t border-border bg-wash/40 p-8 lg:border-l lg:border-t-0">
              <ol className="space-y-5 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Add event details</p>
                    <p className="mt-1 text-muted">Name, schedule, venue, and description.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Upload the poster</p>
                    <p className="mt-1 text-muted">Stored on the backend and reused across listings.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Add tickets and submit</p>
                    <p className="mt-1 text-muted">Send it for review when the event is ready.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2" aria-label="Your events">
          {filteredEvents.map((event) => {
            const bannerSrc = event.bannerUrl
              ? getEventBannerUrl(event.bannerUrl)
              : null;
            return (
            <li key={event.id}>
              <article className="group h-full overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_8px_32px_-16px_rgba(240,114,65,0.18)]">
                <div className="grid h-full sm:grid-cols-[12rem_1fr]">
                  <div className="relative aspect-[16/10] w-full shrink-0 border-b border-border sm:aspect-auto sm:min-h-[13rem] sm:border-b-0 sm:border-r">
                    {bannerSrc ? (
                      <Image
                        src={bannerSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 192px"
                        unoptimized={shouldUnoptimizeEventImage(bannerSrc)}
                      />
                    ) : (
                      <div className="flex h-full min-h-[10rem] w-full flex-col items-center justify-center gap-2 bg-wash px-4 text-center sm:min-h-0">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                          No poster
                        </span>
                        {(event.status === EventStatus.DRAFT ||
                          event.status === EventStatus.PENDING_REVIEW) ? (
                          <Link
                            href={`/organizer/events/${event.id}/edit?tab=media`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            Add media
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                          {event.title}
                        </h3>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                            event.status,
                          )}`}
                        >
                          {formatEventStatus(event.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span className="whitespace-nowrap tabular-nums">
                          {formatDate(event.startAt)}
                        </span>
                        <span className="text-foreground/25" aria-hidden>
                          ·
                        </span>
                        <span className="whitespace-nowrap tabular-nums">
                          {formatDate(event.endAt)}
                        </span>
                        {event.venue ? (
                          <>
                            <span className="text-foreground/25" aria-hidden>
                              ·
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="shrink-0 text-primary"
                                aria-hidden
                              >
                                <path
                                  d="M12 21s-7-4.35-7-11a7 7 0 1 1 14 0c0 6.65-7 11-7 11Z"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinejoin="round"
                                />
                                <circle cx="12" cy="10" r="2.25" fill="currentColor" />
                              </svg>
                              <span className="truncate">{event.venue}</span>
                            </span>
                          </>
                        ) : null}
                        <span className="text-foreground/25" aria-hidden>
                          ·
                        </span>
                        <span className="capitalize whitespace-nowrap">
                          {formatEventType(event.type)}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-muted">{event.slug}</p>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-relaxed text-muted">
                        {event.bannerUrl
                          ? "Poster ready for public surfaces."
                          : "Poster still needed before this listing looks complete."}
                      </p>
                      <Link href={`/organizer/events/${event.id}/edit`} className="shrink-0">
                        <Button variant="secondary" className="w-full sm:w-auto">
                          Open editor
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function EventsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-muted">Loading events…</p>
        </div>
      }
    >
      <EventsListPageContent />
    </Suspense>
  );
}
