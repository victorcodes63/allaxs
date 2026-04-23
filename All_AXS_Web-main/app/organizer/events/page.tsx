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

function EventsListPageContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          Draft, submitted, and live events you own. Use filters to narrow the list.
        </p>
        <Link href="/organizer/events/new" className="shrink-0">
          <Button>Create event</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor="organizer-events-status-filter"
          className="text-sm font-medium text-foreground"
        >
          Filter by status
        </label>
        <select
          id="organizer-events-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[2.75rem] w-full max-w-xs rounded-[var(--radius-button)] border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-[var(--btn-shadow-outline)] transition-[border-color,box-shadow] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-auto"
        >
          <option value="all">All statuses</option>
          <option value={EventStatus.DRAFT}>Draft</option>
          <option value={EventStatus.PENDING_REVIEW}>Pending review</option>
          <option value={EventStatus.APPROVED}>Approved</option>
          <option value={EventStatus.PUBLISHED}>Published</option>
          <option value={EventStatus.REJECTED}>Rejected</option>
          <option value={EventStatus.ARCHIVED}>Archived</option>
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-10 text-center sm:p-14">
          <p className="mb-6 text-base text-muted">
            {queryRaw
              ? `No events match “${queryRaw}”. Try another search or clear filters.`
              : statusFilter === "all"
                ? "No events yet. Create your first event to get started."
                : `No events match “${statusFilter.replace(/_/g, " ").toLowerCase()}”.`}
          </p>
          {queryRaw ? (
            <Link href="/organizer/events" className="text-sm font-medium text-primary hover:underline">
              Clear search
            </Link>
          ) : null}
          {!queryRaw && statusFilter === "all" && (
            <Link href="/organizer/events/new">
              <Button>Create your first event</Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Your events">
          {filteredEvents.map((event) => {
            const bannerSrc = event.bannerUrl
              ? getEventBannerUrl(event.bannerUrl)
              : null;
            return (
            <li key={event.id}>
              <article className="group overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_8px_32px_-16px_rgba(240,114,65,0.18)]">
                <div className="flex flex-col sm:flex-row">
                  <div className="relative aspect-[16/10] w-full shrink-0 border-b border-border sm:aspect-auto sm:h-[7.5rem] sm:w-[11rem] sm:border-b-0 sm:border-r">
                    {bannerSrc ? (
                      <Image
                        src={bannerSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 176px"
                        unoptimized={shouldUnoptimizeEventImage(bannerSrc)}
                      />
                    ) : (
                      <div className="flex h-full min-h-[9rem] w-full items-center justify-center bg-wash sm:min-h-0">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted">
                          No banner
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                        {event.title}
                      </h3>
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
                          {event.type.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-muted">{event.slug}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end md:flex-row md:items-center">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                          event.status,
                        )}`}
                      >
                        {event.status.replace(/_/g, " ")}
                      </span>
                      {!event.bannerUrl &&
                        (event.status === EventStatus.DRAFT ||
                          event.status === EventStatus.PENDING_REVIEW) && (
                          <Link
                            href={`/organizer/events/${event.id}/edit?tab=media`}
                            className="min-w-0"
                          >
                            <Button
                              variant="secondary"
                              className="w-auto whitespace-nowrap border-primary/40 text-primary hover:border-primary hover:bg-primary/[0.08]"
                            >
                              Add poster
                            </Button>
                          </Link>
                        )}
                      <Link href={`/organizer/events/${event.id}/edit`} className="min-w-0">
                        <Button variant="secondary" className="w-auto min-w-[5.5rem] whitespace-nowrap">
                          Edit
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
