"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";
import {
  normalizeOrganizerProfilePayload,
  payoutMethodLabel,
  type OrganizerProfileDisplay,
} from "@/lib/organizer-profile-display";
import { getEventBannerUrl, shouldUnoptimizeEventImage } from "@/lib/utils/image";
import { EventStatus } from "@/lib/validation/event";
import {
  formatMoneyFromCents,
  normalizeOrganizerSalesSummary,
  type OrganizerSalesRollup,
} from "@/lib/organizer-sales";

interface OrganizerEventRow {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
  venue?: string;
  slug: string;
  bannerUrl?: string | null;
  type?: "IN_PERSON" | "VIRTUAL" | "HYBRID";
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusSentence(status: string): string {
  switch (status) {
    case EventStatus.PENDING_REVIEW:
      return "Waiting for admin review before it can go live.";
    case EventStatus.REJECTED:
      return "Update details in the editor, then submit again.";
    case EventStatus.APPROVED:
      return "Approved — publish when you are ready from the editor.";
    case EventStatus.DRAFT:
      return "Still a draft — finish details, media, and ticket types.";
    case EventStatus.PUBLISHED:
      return "Live on discovery — fans can view and purchase.";
    case EventStatus.ARCHIVED:
      return "Archived — no longer shown publicly.";
    default:
      return "Open the editor to continue.";
  }
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

function CompactEventRow({
  event,
  subtitle,
}: {
  event: OrganizerEventRow;
  subtitle?: string;
}) {
  const bannerSrc = event.bannerUrl ? getEventBannerUrl(event.bannerUrl) : null;
  return (
    <li>
      <Link
        href={`/organizer/events/${event.id}/edit`}
        className="group flex gap-4 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-3 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_8px_32px_-16px_rgba(240,114,65,0.18)] sm:p-4"
      >
        <div className="relative h-[4.5rem] w-[7rem] shrink-0 overflow-hidden rounded-lg border border-border/80 bg-wash sm:h-[4.75rem] sm:w-[7.5rem]">
          {bannerSrc ? (
            <Image
              src={bannerSrc}
              alt=""
              fill
              className="object-cover"
              sizes="120px"
              unoptimized={shouldUnoptimizeEventImage(bannerSrc)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-1 text-center">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                No banner
              </span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-semibold tracking-tight text-foreground group-hover:text-primary sm:text-lg">
              {event.title}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                event.status,
              )}`}
            >
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-xs text-muted tabular-nums sm:text-sm">{formatDateTime(event.startAt)}</p>
          {subtitle ? <p className="text-xs leading-snug text-muted">{subtitle}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export default function OrganizerDashboardPage(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OrganizerProfileDisplay | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [events, setEvents] = useState<OrganizerEventRow[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  /** Wall time when events were last loaded — used to classify "upcoming" without impure calls in render. */
  const [eventsFetchedAtMs, setEventsFetchedAtMs] = useState<number | null>(null);
  const [salesRollup, setSalesRollup] = useState<OrganizerSalesRollup | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setProfileLoadError(null);
    setEventsError(null);
    setSalesError(null);

    const results = await Promise.allSettled([
      axios.get<unknown>("/api/organizer/profile"),
      axios.get<unknown>("/api/events"),
      axios.get<unknown>("/api/organizer/sales/summary"),
    ]);

    const profileOutcome = results[0];
    const eventsOutcome = results[1];
    const salesOutcome = results[2];

    if (profileOutcome.status === "rejected") {
      const err = profileOutcome.reason;
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404) {
        router.replace("/organizer/onboarding");
        setLoading(false);
        return;
      }
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setProfileLoadError(msg || "We could not load your organizer profile. Try again.");
      setProfile({
        orgName: "Your organization",
        supportEmail: user?.email ?? "—",
      });
    } else {
      const normalized = normalizeOrganizerProfilePayload(profileOutcome.value.data);
      setProfile(
        normalized ?? {
          orgName: "Your organization",
          supportEmail: user?.email ?? "—",
        },
      );
    }

    if (eventsOutcome.status === "fulfilled") {
      const list = normalizeOrganizerEventsListPayload<OrganizerEventRow>(eventsOutcome.value.data);
      setEvents(
        list
          .filter((e) => e.id && e.title)
          .map((e) => ({
            ...e,
            type: e.type ?? "IN_PERSON",
          })),
      );
    } else {
      const err = eventsOutcome.reason;
      if (!isAxiosError(err)) {
        setEventsError("Something went wrong while loading your events.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setEventsError("Network error — check your connection and try again.");
      } else {
        const status = err.response.status;
        const serverMessage = (err.response.data as { message?: string })?.message;
        if (status === 401) {
          setEventsError("Your session expired — sign in again to load events.");
        } else if (status === 403) {
          setEventsError("You do not have permission to list events.");
        } else {
          setEventsError(serverMessage || "Failed to load events. Please try again.");
        }
      }
      setEvents([]);
    }

    if (salesOutcome.status === "fulfilled") {
      const normalized = normalizeOrganizerSalesSummary(salesOutcome.value.data);
      setSalesRollup(normalized?.rollup ?? null);
      if (!normalized) {
        setSalesError("Sales summary returned an unexpected shape.");
      }
    } else {
      setSalesRollup(null);
      const err = salesOutcome.reason;
      if (!isAxiosError(err)) {
        setSalesError("Could not load sales summary.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setSalesError("Network error while loading sales.");
      } else {
        const status = err.response.status;
        const serverMessage = (err.response.data as { message?: string })?.message;
        if (status === 401 || status === 403) {
          setSalesError(null);
        } else {
          setSalesError(serverMessage || "Could not load sales summary.");
        }
      }
    }

    setEventsFetchedAtMs(Date.now());
    setLoading(false);
  }, [router, user?.email]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const total = events.length;
    const published = events.filter((e) => e.status === EventStatus.PUBLISHED).length;
    const pendingReview = events.filter((e) => e.status === EventStatus.PENDING_REVIEW).length;
    const drafts = events.filter((e) => e.status === EventStatus.DRAFT).length;
    const approved = events.filter((e) => e.status === EventStatus.APPROVED).length;
    const rejected = events.filter((e) => e.status === EventStatus.REJECTED).length;
    return { total, published, pendingReview, drafts, approved, rejected };
  }, [events]);

  const upcomingEvents = useMemo(() => {
    if (eventsFetchedAtMs === null) return [];
    return events
      .filter((e) => {
        const t = new Date(e.startAt).getTime();
        if (Number.isNaN(t) || t < eventsFetchedAtMs) return false;
        return (
          e.status === EventStatus.PUBLISHED ||
          e.status === EventStatus.APPROVED
        );
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 5);
  }, [events, eventsFetchedAtMs]);

  const attentionEvents = useMemo(() => {
    const flagged = events.filter(
      (e) =>
        e.status === EventStatus.REJECTED || e.status === EventStatus.PENDING_REVIEW,
    );
    return flagged
      .sort((a, b) => {
        const rank = (s: string) => (s === EventStatus.REJECTED ? 0 : 1);
        const c = rank(a.status) - rank(b.status);
        if (c !== 0) return c;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      })
      .slice(0, 5);
  }, [events]);

  const recentDrafts = useMemo(() => {
    return events
      .filter((e) => e.status === EventStatus.DRAFT)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 4);
  }, [events]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading your workspace…</p>
        <p className="text-xs text-muted">Fetching profile and events</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">Could not load organizer details.</p>
        <Button type="button" className="w-auto" onClick={() => void loadDashboard()}>
          Retry
        </Button>
      </div>
    );
  }

  const displayProfile = profile;

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser home
        </p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {displayProfile.orgName}
            </h2>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Track drafts, reviews, and live listings in one place. When a show is published,
              it appears on the public calendar for fans to buy passes.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/organizer/events/new">
                <Button className="w-auto min-w-[8.5rem]">New event</Button>
              </Link>
              <Link href="/organizer/events">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  All events
                </Button>
              </Link>
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] lg:max-w-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Organizer account
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted">Support email</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">{displayProfile.supportEmail}</dd>
              </div>
              {displayProfile.supportPhone ? (
                <div>
                  <dt className="text-xs font-medium text-muted">Support phone</dt>
                  <dd className="mt-0.5 text-foreground">{displayProfile.supportPhone}</dd>
                </div>
              ) : null}
              {displayProfile.website ? (
                <div>
                  <dt className="text-xs font-medium text-muted">Website</dt>
                  <dd className="mt-0.5 truncate">
                    <a
                      href={displayProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary"
                    >
                      {displayProfile.website}
                    </a>
                  </dd>
                </div>
              ) : null}
              {displayProfile.payoutMethod ? (
                <div>
                  <dt className="text-xs font-medium text-muted">Payout method</dt>
                  <dd className="mt-0.5 text-foreground">{payoutMethodLabel(displayProfile.payoutMethod)}</dd>
                </div>
              ) : null}
              {displayProfile.legalName ? (
                <div>
                  <dt className="text-xs font-medium text-muted">Legal name</dt>
                  <dd className="mt-0.5 text-foreground">{displayProfile.legalName}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-border/80 pt-4">
              <Link
                href="/organizer/account"
                className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Manage account
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Banking and tax updates go through support after onboarding — keep this profile accurate
                for fan communications.
              </p>
            </div>
          </aside>
        </div>
      </header>

      {profileLoadError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {profileLoadError}{" "}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="font-semibold text-foreground underline decoration-amber-200/50 underline-offset-2 hover:decoration-foreground"
          >
            Retry
          </button>
        </div>
      ) : null}

      {eventsError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {eventsError}{" "}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="font-semibold text-foreground underline decoration-red-200/40 underline-offset-2 hover:decoration-foreground"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section aria-labelledby="org-stats-heading">
        <h3
          id="org-stats-heading"
          className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50 sm:mb-4"
        >
          At a glance
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          <StatTile label="All events" value={stats.total} hint="Everything you own in All AXS." />
          <StatTile
            label="Live"
            value={stats.published}
            hint="Listed on discovery — fans can purchase."
          />
          <StatTile
            label="In review"
            value={stats.pendingReview}
            hint="Submitted and waiting on admin approval."
          />
          <StatTile label="Drafts" value={stats.drafts} hint="Not submitted yet — keep editing." />
        </div>
        {(stats.approved > 0 || stats.rejected > 0) && !eventsError ? (
          <p className="mt-3 text-xs text-muted">
            {stats.approved > 0 ? (
              <>
                <span className="font-medium text-foreground">{stats.approved}</span> approved and
                ready to publish when you are.
              </>
            ) : null}
            {stats.approved > 0 && stats.rejected > 0 ? " " : null}
            {stats.rejected > 0 ? (
              <>
                <span className="font-medium text-foreground">{stats.rejected}</span> rejected — open
                each event to adjust and resubmit.
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="sales-teaser-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3
            id="sales-teaser-heading"
            className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
          >
            Ticket sales
          </h3>
          <Link
            href="/organizer/sales"
            className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
          >
            Sales &amp; orders
          </Link>
        </div>
        {salesError ? (
          <p className="text-sm text-muted">
            {salesError}{" "}
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              Retry
            </button>
          </p>
        ) : salesRollup ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Gross (paid)</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {formatMoneyFromCents(salesRollup.grossCents, salesRollup.currency)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Sum of paid order totals.</p>
            </div>
            <StatTile label="Tickets sold" value={salesRollup.ticketsSold} hint="Across paid orders." />
            <StatTile label="Paid orders" value={salesRollup.ordersCount} hint="Successful checkouts." />
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Fees recorded</p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {formatMoneyFromCents(salesRollup.feesCents, salesRollup.currency)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">Per order; net depends on your contract.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Sales totals will appear here once the summary loads. Open{" "}
            <Link href="/organizer/sales" className="font-medium text-primary hover:underline">
              Sales &amp; orders
            </Link>{" "}
            for per-event breakdowns and the order log.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h3
              id="upcoming-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Upcoming on the calendar
            </h3>
            {upcomingEvents.length > 0 ? (
              <Link
                href="/organizer/events"
                className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                View all
              </Link>
            ) : null}
          </div>
          {eventsError ? (
            <p className="text-sm text-muted">Load events to see upcoming dates here.</p>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
              <p className="text-sm text-muted">
                No upcoming published or approved events yet. Publish a reviewed event or schedule a
                new one to see it here.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/organizer/events/new">
                  <Button className="w-auto">Create event</Button>
                </Link>
                <Link href="/organizer/events">
                  <Button variant="secondary" className="w-auto">
                    Manage events
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((event) => (
                <CompactEventRow key={event.id} event={event} subtitle={statusSentence(event.status)} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="attention-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h3
              id="attention-heading"
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Needs your attention
            </h3>
            {attentionEvents.length > 0 ? (
              <Link
                href="/organizer/events"
                className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Events list
              </Link>
            ) : null}
          </div>
          {eventsError ? (
            <p className="text-sm text-muted">Load events to surface review and rejection items.</p>
          ) : attentionEvents.length === 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
              <p className="text-sm text-muted">
                Nothing waiting on you right now. Submitted events will appear here while admins
                review them, and rejected events land here with next steps.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {attentionEvents.map((event) => (
                <CompactEventRow
                  key={event.id}
                  event={event}
                  subtitle={statusSentence(event.status)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="drafts-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 id="drafts-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
            Recent drafts
          </h3>
          {recentDrafts.length > 0 ? (
            <Link
              href="/organizer/events"
              className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
            >
              All drafts
            </Link>
          ) : null}
        </div>
        {eventsError ? null : recentDrafts.length === 0 ? (
          <p className="text-sm text-muted">
            No drafts in progress. Start a new event to build media, ticket tiers, and copy before
            submitting for review.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recentDrafts.map((event) => (
              <CompactEventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="fan-preview-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-background p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:p-6"
      >
        <h3
          id="fan-preview-heading"
          className="text-[11px] font-bold uppercase tracking-wide text-primary"
        >
          Fan preview
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          See what attendees see on the public site. Passes they buy show up under{" "}
          <strong className="font-medium text-foreground">My tickets</strong> with QR codes for door
          teams.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/80 pt-4">
          <Link
            href="/events"
            className="text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Browse public events
          </Link>
          <Link
            href="/tickets"
            className="text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Open My tickets
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Fan account home
          </Link>
        </div>
      </section>
    </div>
  );
}
