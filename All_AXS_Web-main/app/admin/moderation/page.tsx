"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { ReviewPanel } from "@/components/admin/ReviewPanel";
import { EventStatus } from "@/lib/validation/event";
import { useAuth } from "@/lib/auth";
import { useSelection, type SelectionApi } from "@/lib/hooks/use-selection";
import {
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

interface Organizer {
  id: string;
  orgName: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

interface ModerationEvent {
  id: string;
  title: string;
  description?: string;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  city?: string;
  country?: string;
  startAt: string;
  endAt: string;
  status: string;
  bannerUrl?: string | null;
  organizer: Organizer;
  ticketTypes?: Array<{ id: string; name: string }>;
  createdAt: string;
  metadata?: {
    rejectionReason?: string;
  };
}

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: EventStatus.PENDING_REVIEW, label: "Pending review" },
  { value: EventStatus.PUBLISHED, label: "Published" },
  { value: EventStatus.REJECTED, label: "Rejected" },
  { value: EventStatus.DRAFT, label: "Draft" },
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

/** Compact list-view action — sized for density, matches `/admin/events`. */
const ROW_ACTION_BASE =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
const ROW_ACTION_PRIMARY = `${ROW_ACTION_BASE} border border-primary/55 bg-primary/15 text-primary hover:bg-primary/25 hover:text-foreground`;
const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} border border-red-400/35 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white`;
const ROW_ACTION_GHOST = `${ROW_ACTION_BASE} border border-transparent text-muted hover:border-border hover:bg-wash/40 hover:text-foreground`;

function AdminModerationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const initialStatus =
    STATUS_FILTERS.find((f) => f.value === searchParams.get("status"))?.value ??
    EventStatus.PENDING_REVIEW;
  const initialSearch = searchParams.get("search") ?? "";

  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [selectedEvent, setSelectedEvent] = useState<ModerationEvent | null>(
    null,
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Bulk dialog state lives at the page level so a single row's Approve /
  // Reject button can also reuse it (single + bulk share the same flow).
  const [confirmKind, setConfirmKind] = useState<"approve" | "reject" | null>(
    null,
  );
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auth guard. The admin layout already gates access, but keep this in
  // case anything else navigates here directly.
  useEffect(() => {
    if (!authLoading && user && !user.roles?.includes("ADMIN")) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedSearch.trim())
        params.set("search", debouncedSearch.trim());
      const qs = params.toString();
      const response = await axios.get<ModerationEvent[]>(
        `/api/admin/events${qs ? `?${qs}` : ""}`,
      );
      setEvents(response.data ?? []);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        setError("You do not have permission to access this page");
        router.replace("/dashboard");
        return;
      }
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load events.";
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, router]);

  useEffect(() => {
    if (!authLoading && user?.roles?.includes("ADMIN")) {
      void load();
    }
  }, [load, user, authLoading]);

  // Keep URL in sync so the queue is shareable + survives refresh,
  // mirroring `/admin/events`.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (statusFilter !== EventStatus.PENDING_REVIEW)
      sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    const qs = sp.toString();
    router.replace(qs ? `/admin/moderation?${qs}` : "/admin/moderation", {
      scroll: false,
    });
  }, [router, statusFilter, debouncedSearch]);

  const getId = useCallback((event: ModerationEvent) => event.id, []);
  const selection = useSelection(events, getId);
  const { clear: clearSelection } = selection;

  // Switching filters or executing actions should clear stale selection
  // so users don't accidentally bulk-approve hidden ids.
  useEffect(() => {
    clearSelection();
  }, [statusFilter, debouncedSearch, clearSelection]);

  const counts = useMemo(() => {
    const acc = {
      total: events.length,
      pending: 0,
      published: 0,
      rejected: 0,
    };
    for (const event of events) {
      if (event.status === EventStatus.PENDING_REVIEW) acc.pending += 1;
      if (event.status === EventStatus.PUBLISHED) acc.published += 1;
      if (event.status === EventStatus.REJECTED) acc.rejected += 1;
    }
    return acc;
  }, [events]);

  const openConfirm = (kind: "approve" | "reject", ids: string[]) => {
    if (ids.length === 0) return;
    setConfirmKind(kind);
    setConfirmIds(ids);
    setRejectReason("");
    setError(null);
  };

  const closeConfirm = () => {
    if (submitting) return;
    setConfirmKind(null);
    setConfirmIds([]);
    setRejectReason("");
  };

  const handleReviewPanelClose = () => setSelectedEvent(null);

  const handleReviewPanelComplete = () => {
    setSelectedEvent(null);
    void load();
  };

  const executeBulk = async () => {
    if (!confirmKind || confirmIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    setActionMessage(null);

    const endpoint = (id: string) =>
      confirmKind === "approve"
        ? axios.post(`/api/admin/events/${id}/approve`)
        : axios.post(`/api/admin/events/${id}/reject`, {
            reason: rejectReason.trim() || undefined,
          });

    const results = await Promise.allSettled(confirmIds.map((id) => endpoint(id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    // Build a result message instead of relying on per-row toasts. This
    // is concise and works whether the user actioned 1 or 50.
    const actionVerb = confirmKind === "approve" ? "Approved" : "Rejected";
    let summary = `${actionVerb} ${succeeded} event${succeeded === 1 ? "" : "s"}.`;
    if (failed > 0) {
      summary += ` ${failed} could not be ${confirmKind === "approve" ? "approved" : "rejected"} (already moderated or no longer eligible).`;
    }
    setActionMessage(summary);
    setSubmitting(false);
    setConfirmKind(null);
    setConfirmIds([]);
    setRejectReason("");
    clearSelection();
    setTimeout(() => setActionMessage(null), 6000);
    await load();
  };

  if (authLoading) {
    return (
      <main
        className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
      >
        <p className="text-sm text-muted">Loading queue…</p>
      </main>
    );
  }

  if (!user?.roles?.includes("ADMIN")) {
    return (
      <main
        className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
      >
        <p className="text-lg text-primary">
          You do not have permission to access this page
        </p>
      </main>
    );
  }

  const isPendingFilter = statusFilter === EventStatus.PENDING_REVIEW;

  return (
    <main className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Moderation
          </p>
          <h1 className="mt-1.5 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Event review queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Approve or send back events submitted by organisers. Pending
            submissions are listed first; switch the filter to inspect history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted sm:shrink-0">
          <span className="rounded-full border border-border/70 bg-surface/80 px-3 py-1">
            {counts.total} shown
          </span>
          {isPendingFilter ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
              {counts.pending} pending
            </span>
          ) : null}
          {counts.published > 0 ? (
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              {counts.published} live
            </span>
          ) : null}
        </div>
      </header>

      {actionMessage ? (
        <div
          className="rounded-[var(--radius-panel)] border border-sky-400/30 bg-sky-500/10 p-3.5 text-sm leading-relaxed text-sky-100 sm:p-4"
          role="status"
        >
          {actionMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-100 sm:p-4">
          {error}
        </div>
      ) : null}

      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:flex-row sm:items-end sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex-[2]">
          <label
            htmlFor="admin-moderation-search"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <input
            id="admin-moderation-search"
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

      {/*
        Bulk action bar — only relevant for pending review. Other statuses
        cannot be bulk-actioned (they have already been moderated).
       */}
      {isPendingFilter && events.length > 0 ? (
        <BulkActionBar
          selection={selection}
          events={events}
          onBulkApprove={() => openConfirm("approve", selection.ids)}
          onBulkReject={() => openConfirm("reject", selection.ids)}
        />
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          {debouncedSearch.trim()
            ? `No events match “${debouncedSearch.trim()}”.`
            : isPendingFilter
              ? "Inbox zero — no events are waiting for review."
              : `No events with status “${statusFilter.replace(/_/g, " ").toLowerCase()}”.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <ModerationEventCard
              key={event.id}
              event={event}
              isPendingFilter={isPendingFilter}
              isSelected={selection.isSelected(event.id)}
              onToggleSelected={() => selection.toggle(event.id)}
              onReview={() => setSelectedEvent(event)}
              onApprove={() => openConfirm("approve", [event.id])}
              onReject={() => openConfirm("reject", [event.id])}
            />
          ))}
        </ul>
      )}

      <ReviewPanel
        event={selectedEvent}
        onClose={handleReviewPanelClose}
        onActionComplete={handleReviewPanelComplete}
      />

      <Dialog
        open={confirmKind === "approve"}
        onClose={closeConfirm}
        title={
          confirmIds.length > 1
            ? `Approve ${confirmIds.length} events?`
            : "Approve event?"
        }
        ariaLabel="Confirm approve"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={closeConfirm}
              disabled={submitting}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={executeBulk}
              disabled={submitting}
              className="w-auto"
            >
              {submitting
                ? "Approving…"
                : confirmIds.length > 1
                  ? `Approve ${confirmIds.length}`
                  : "Approve"}
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-foreground/85">
          {confirmIds.length > 1
            ? `Approve ${confirmIds.length} pending events and publish them. Organisers will be notified.`
            : "Approve this event and publish it to the catalogue. The organiser will be notified."}
        </p>
      </Dialog>

      <Dialog
        open={confirmKind === "reject"}
        onClose={closeConfirm}
        title={
          confirmIds.length > 1
            ? `Reject ${confirmIds.length} events?`
            : "Reject event?"
        }
        ariaLabel="Reject events"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={closeConfirm}
              disabled={submitting}
              className="w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={executeBulk}
              disabled={submitting}
              className="w-auto bg-red-600 text-white hover:bg-red-700"
            >
              {submitting
                ? "Rejecting…"
                : confirmIds.length > 1
                  ? `Reject ${confirmIds.length}`
                  : "Reject"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/85">
            {confirmIds.length > 1
              ? `The same reason (if provided) will be attached to each of the ${confirmIds.length} events. Organisers will see it on their event editor.`
              : "Provide an optional reason. The organiser will see it on their event editor."}
          </p>
          <Textarea
            label="Rejection reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Event does not meet our guidelines…"
            rows={4}
            aria-label="Rejection reason"
          />
        </div>
      </Dialog>
    </main>
  );
}

function BulkActionBar({
  selection,
  events,
  onBulkApprove,
  onBulkReject,
}: {
  selection: SelectionApi;
  events: ReadonlyArray<ModerationEvent>;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}) {
  const allChecked = selection.allSelected;
  const some = selection.anySelected && !allChecked;

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border bg-surface/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <input
          type="checkbox"
          aria-label={
            allChecked ? "Clear selection" : "Select all on this page"
          }
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = some;
          }}
          onChange={selection.toggleAll}
          className="h-4 w-4 cursor-pointer rounded border-border bg-surface text-primary focus:ring-primary/30"
        />
        {selection.size > 0
          ? `${selection.size} selected`
          : `Select all (${events.length})`}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {selection.size > 0 ? (
          <button
            type="button"
            onClick={selection.clear}
            className={ROW_ACTION_GHOST}
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBulkReject}
          disabled={selection.size === 0}
          className={`${ROW_ACTION_DANGER} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Reject selected
        </button>
        <button
          type="button"
          onClick={onBulkApprove}
          disabled={selection.size === 0}
          className={`${ROW_ACTION_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Approve selected
        </button>
      </div>
    </div>
  );
}

function ModerationEventCard({
  event,
  isPendingFilter,
  isSelected,
  onToggleSelected,
  onReview,
  onApprove,
  onReject,
}: {
  event: ModerationEvent;
  isPendingFilter: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const bannerSrc = event.bannerUrl ? getEventBannerUrl(event.bannerUrl) : null;
  const tierCount = event.ticketTypes?.length ?? 0;
  const venueLine =
    [event.venue, event.city, event.country].filter(Boolean).join(" · ") ||
    null;

  return (
    <li
      className={`flex flex-col gap-4 rounded-[var(--radius-panel)] border bg-surface/85 p-4 transition-[border-color,box-shadow] sm:flex-row sm:items-start sm:p-5 ${
        isSelected
          ? "border-primary/55 ring-1 ring-primary/35"
          : "border-border hover:border-primary/30"
      }`}
    >
      {isPendingFilter ? (
        <div className="flex shrink-0 items-start pt-1 sm:pt-2">
          <input
            type="checkbox"
            aria-label={`Select ${event.title}`}
            checked={isSelected}
            onChange={onToggleSelected}
            className="h-5 w-5 cursor-pointer rounded border-border bg-surface text-primary focus:ring-primary/30"
          />
        </div>
      ) : null}
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
        {venueLine ? <p className="text-xs text-muted">{venueLine}</p> : null}
        {event.metadata?.rejectionReason ? (
          <p
            className="text-xs italic leading-snug text-red-100/85"
            title="Rejection reason on file"
          >
            “{event.metadata.rejectionReason}”
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-1.5 sm:items-end sm:justify-end sm:self-center">
        <button
          type="button"
          onClick={onReview}
          className={ROW_ACTION_GHOST}
          aria-label={`Review details for ${event.title}`}
        >
          Details
        </button>
        {isPendingFilter ? (
          <>
            <button
              type="button"
              onClick={onReject}
              className={ROW_ACTION_DANGER}
              aria-label={`Reject ${event.title}`}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              className={ROW_ACTION_PRIMARY}
              aria-label={`Approve ${event.title}`}
            >
              Approve
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

export default function AdminModerationPage() {
  return (
    <Suspense
      fallback={
        <main
          className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
        >
          <p className="text-sm text-muted">Loading queue…</p>
        </main>
      }
    >
      <AdminModerationPageContent />
    </Suspense>
  );
}
