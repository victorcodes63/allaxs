"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { EventStatus } from "@/lib/validation/event";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";
import {
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

type EventStatusKey = (typeof EventStatus)[keyof typeof EventStatus];

interface PendingReviewItem {
  id: string;
  title: string;
  slug?: string | null;
  startAt: string;
  endAt: string;
  submittedAt: string;
  bannerUrl?: string | null;
  organizer: {
    id?: string | null;
    orgName: string;
    email?: string | null;
    name?: string | null;
  };
}

interface RecentActivityItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  status: string;
  createdAt: string;
  admin: { id: string; email: string; name?: string | null } | null;
  metadata: Record<string, unknown> | null;
}

/** Daily order aggregate used by the paid/refunded sparklines. */
type OrderTrendPoint = {
  date: string;
  count: number;
  grossCents: number;
};

interface AdminOverview {
  generatedAt: string;
  events: {
    byStatus: Record<EventStatusKey, number>;
    submissionTrend: Array<{ date: string; count: number }>;
    pendingReviewQueue: PendingReviewItem[];
  };
  orders: {
    byStatus: Record<string, number>;
    paid: {
      count: number;
      grossCents: number;
      feesCents: number;
      netCents: number;
    };
    refunded: {
      count: number;
      grossCents: number;
    };
    paidTrend: OrderTrendPoint[];
    refundedTrend: OrderTrendPoint[];
  };
  users: {
    total: number;
    admins: number;
    organizers: number;
    attendees: number;
  };
  recentActivity: RecentActivityItem[];
}

function formatDateTime(value: string): string {
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

function formatRelative(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return formatDateTime(value);
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDateTime(value);
}

function actionLabel(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function actionTone(action: string): string {
  if (action.includes("APPROVE"))
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  if (action.includes("REJECT") || action.includes("REFUND"))
    return "border-red-400/30 bg-red-500/10 text-red-100";
  if (action.includes("ROLE"))
    return "border-sky-400/25 bg-sky-500/10 text-sky-100";
  return "border-white/10 bg-white/[0.06] text-foreground/80";
}

function activityHref(item: RecentActivityItem): string | null {
  if (!item.resourceId) return null;
  if (item.resourceType === "event") return `/admin/events/${item.resourceId}`;
  if (item.resourceType === "user") {
    const targetEmail =
      typeof item.metadata?.targetUserEmail === "string"
        ? item.metadata.targetUserEmail
        : item.resourceId;
    return `/admin/users?search=${encodeURIComponent(targetEmail)}`;
  }
  if (item.resourceType === "order") {
    return `/admin/orders?search=${encodeURIComponent(item.resourceId)}`;
  }
  return null;
}

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  cta,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "warn" | "good" | "bad" | "info";
  href?: string;
  cta?: string;
}) {
  const toneRing =
    tone === "warn"
      ? "border-amber-400/40 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)]"
      : tone === "good"
        ? "border-emerald-400/35"
        : tone === "bad"
          ? "border-red-400/35"
          : tone === "info"
            ? "border-sky-400/30"
            : "border-border";
  return (
    <div
      className={`rounded-[var(--radius-panel)] ${toneRing} bg-surface/90 p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:mt-2 sm:text-4xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
      {href && cta ? (
        <Link
          href={href}
          className="mt-2.5 inline-flex min-h-[2.25rem] items-center text-xs font-semibold uppercase tracking-wide text-primary hover:underline sm:mt-3"
        >
          {cta}
          <span aria-hidden className="ml-1">
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

function RecentActivityRow({ item }: { item: RecentActivityItem }) {
  const meta = item.metadata ?? {};
  const eventTitle =
    typeof meta.eventTitle === "string" ? meta.eventTitle : null;
  const reason =
    typeof meta.reason === "string" && meta.reason.trim().length > 0
      ? meta.reason
      : null;
  const refundCents =
    typeof meta.refundAmountCents === "number"
      ? Number(meta.refundAmountCents)
      : null;
  const targetEmail =
    typeof meta.targetUserEmail === "string" ? meta.targetUserEmail : null;
  const subject =
    eventTitle ??
    targetEmail ??
    (typeof item.resourceId === "string"
      ? item.resourceId.slice(0, 8)
      : item.resourceType);
  const href = activityHref(item);

  const body = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <span
        className={`inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:mt-0.5 ${actionTone(item.action)}`}
      >
        {actionLabel(item.action)}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:line-clamp-1 sm:truncate">
          {subject}
        </p>
        <p className="text-xs text-muted">
          <span className="font-medium text-foreground/85">
            {item.admin?.name || item.admin?.email || "System"}
          </span>{" "}
          · {formatRelative(item.createdAt)}
        </p>
        {reason ? (
          <p className="text-xs italic leading-snug text-muted">“{reason}”</p>
        ) : null}
        {refundCents !== null ? (
          <p className="text-xs text-muted">
            Refunded{" "}
            <span className="font-medium text-foreground/85">
              {formatMoneyFromCents(refundCents, "KES")}
            </span>
          </p>
        ) : null}
      </div>
      {href ? (
        <span
          aria-hidden
          className="shrink-0 self-end text-xs font-semibold text-primary sm:mt-0.5 sm:self-start"
        >
          →
        </span>
      ) : null}
    </div>
  );

  return (
    <li className="rounded-[var(--radius-panel)] border border-border/60 bg-surface/70 transition-[border-color,background-color] hover:border-primary/25">
      {href ? (
        <Link href={href} className="block p-3.5 sm:p-4">
          {body}
        </Link>
      ) : (
        <div className="p-3.5 sm:p-4">{body}</div>
      )}
    </li>
  );
}

/**
 * Tiny SVG sparkline for KPI cards (paid / refunded daily counts).
 *
 * Renders points as a single-stroke polyline scaled to fit the box, plus a
 * lightly-shaded area underneath so even a flat zero-line is visible against
 * the surface. Designed to read at-a-glance in a 90×24-ish slot.
 */
function Sparkline({
  points,
  ariaLabel,
  tone = "neutral",
}: {
  points: OrderTrendPoint[];
  ariaLabel: string;
  tone?: "neutral" | "positive" | "warn";
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const width = 100;
  const height = 28;
  const stepX =
    points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((p, i) => {
      const x = points.length > 1 ? i * stepX : width / 2;
      const y = height - (p.count / max) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${path} L ${width.toFixed(2)} ${height} L 0 ${height} Z`;
  const stroke =
    tone === "positive"
      ? "stroke-emerald-300"
      : tone === "warn"
        ? "stroke-red-300"
        : "stroke-foreground/70";
  const fill =
    tone === "positive"
      ? "fill-emerald-400/10"
      : tone === "warn"
        ? "fill-red-400/10"
        : "fill-foreground/10";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="block h-7 w-full"
      preserveAspectRatio="none"
    >
      <path d={area} className={fill} />
      <path
        d={path}
        className={stroke}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SubmissionTrendChart({
  points,
}: {
  points: Array<{ date: string; count: number }>;
}) {
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const peak = points.find((point) => point.count === maxCount);

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Submissions over time
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-0.5">
            Last 14 days by submission timestamp. Drafts that have never been
            submitted aren&apos;t counted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
          <span className="rounded-full border border-border/70 bg-wash/50 px-2.5 py-0.5">
            {total} total
          </span>
          {peak ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-primary">
              Peak {peak.count}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className="mt-4 grid h-40 items-end gap-1 px-0.5 sm:mt-5 sm:h-44 sm:gap-2 sm:px-0"
        style={{
          gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))`,
        }}
        role="img"
        aria-label={`Event submissions over the last 14 days. Total ${total}.`}
      >
        {points.map((point) => {
          const height = Math.max(8, (point.count / maxCount) * 100);
          const label = new Date(`${point.date}T00:00:00Z`).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", timeZone: "UTC" },
          );
          return (
            <div
              key={point.date}
              className="group flex h-full min-w-0 flex-col items-center justify-end gap-2"
              title={`${label}: ${point.count} submissions`}
            >
              <div className="flex h-full w-full items-end rounded-t-md bg-wash/35 px-1">
                <div
                  className="w-full rounded-t-md border border-primary/35 bg-gradient-to-t from-primary/65 to-primary/25 transition-[height,background-color] group-hover:from-primary group-hover:to-primary/45"
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold tabular-nums text-foreground/90">
                  {point.count}
                </p>
                <p className="line-clamp-1 text-[9px] leading-tight text-muted sm:text-[10px]">
                  <span className="sm:hidden">{label.replace(". ", " ")}</span>
                  <span className="hidden sm:inline">{label}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PendingReviewCard({ event }: { event: PendingReviewItem }) {
  const bannerSrc = event.bannerUrl ? getEventBannerUrl(event.bannerUrl) : null;
  const startsLabel = formatDateTime(event.startAt);
  return (
    <li>
      <Link
        href="/admin/moderation"
        className="group flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-3.5 transition-[border-color,box-shadow] hover:border-amber-400/40 hover:shadow-[0_8px_32px_-16px_rgba(245,158,11,0.25)] sm:flex-row sm:gap-4 sm:p-4"
      >
        <div className="relative aspect-[21/9] w-full shrink-0 overflow-hidden rounded-lg border border-border/80 bg-wash sm:aspect-auto sm:h-[4.75rem] sm:w-[7.5rem]">
          {bannerSrc ? (
            <Image
              src={bannerSrc}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 639px) 92vw, 120px"
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
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 font-display text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:truncate sm:text-lg">
              {event.title}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                EventStatus.PENDING_REVIEW,
              )}`}
            >
              Pending review
            </span>
          </div>
          <p className="text-xs text-muted sm:text-sm">
            {event.organizer.orgName}
            {event.organizer.email ? (
              <span className="text-muted/70"> · {event.organizer.email}</span>
            ) : null}
          </p>
          <p className="text-xs text-muted tabular-nums">
            Starts {startsLabel} · Submitted {formatRelative(event.submittedAt)}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await axios.get<AdminOverview>("/api/admin/overview");
      setData(response.data);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load admin overview.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 30_000);

    const refreshWhenFocused = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenFocused);
    window.addEventListener("focus", refreshWhenFocused);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenFocused);
      window.removeEventListener("focus", refreshWhenFocused);
    };
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const eventStats = useMemo(() => {
    const fallback = {
      [EventStatus.DRAFT]: 0,
      [EventStatus.PENDING_REVIEW]: 0,
      [EventStatus.APPROVED]: 0,
      [EventStatus.PUBLISHED]: 0,
      [EventStatus.REJECTED]: 0,
      [EventStatus.ARCHIVED]: 0,
    } as Record<EventStatusKey, number>;
    return data?.events.byStatus ?? fallback;
  }, [data]);

  const pendingReview = eventStats[EventStatus.PENDING_REVIEW] ?? 0;
  const published = eventStats[EventStatus.PUBLISHED] ?? 0;
  const rejected = eventStats[EventStatus.REJECTED] ?? 0;
  const drafts = eventStats[EventStatus.DRAFT] ?? 0;

  const queue = data?.events.pendingReviewQueue ?? [];
  const activity = data?.recentActivity ?? [];
  const submissionTrend = data?.events.submissionTrend ?? [];

  if (loading && !data) {
    return (
      <main
        className={`${ADMIN_PAGE_SHELL} flex min-h-[min(50vh,24rem)] flex-col items-center justify-center py-12 sm:py-16`}
      >
        <p className="text-sm text-muted">Loading admin overview…</p>
      </main>
    );
  }

  return (
    <main className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Admin overview
          </p>
          <h1 className="mt-1.5 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Platform health at a glance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Approve incoming submissions, monitor live order volume, and keep
            an eye on recent admin actions. Data auto-refreshes every 30
            seconds while this tab is active.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
          {data ? (
            <span className="text-center text-[11px] uppercase tracking-wide text-muted sm:text-right">
              Updated {formatRelative(data.generatedAt)}
            </span>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end sm:gap-2">
            <Link href="/admin/events" className="min-w-0 sm:inline-flex">
              <Button type="button" variant="secondary" className="w-full sm:w-auto">
                Browse all events
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={onRefresh}
              disabled={refreshing}
              className="w-full sm:w-auto"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-100 sm:p-4">
          {error}
        </div>
      ) : null}

      <section
        aria-label="Event review counts"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4"
      >
        <StatTile
          label="Pending review"
          value={pendingReview}
          tone="warn"
          hint={
            pendingReview === 0
              ? "Inbox zero — no submissions waiting."
              : "Submissions waiting on a moderator."
          }
          href="/admin/moderation"
          cta={pendingReview === 0 ? "Open queue" : "Review now"}
        />
        <StatTile
          label="Live events"
          value={published}
          tone="good"
          hint="Currently published & on sale."
        />
        <StatTile
          label="Rejected"
          value={rejected}
          tone="bad"
          hint="Sent back to organisers for changes."
        />
        <StatTile
          label="Drafts"
          value={drafts}
          tone="neutral"
          hint="In progress, not yet submitted."
        />
      </section>

      <section
        aria-label="Order and revenue summary"
        className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3"
      >
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Sales (paid orders)
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-0.5">
                Lifetime gross collected for orders in PAID status. Refund
                totals reflect orders moved to REFUNDED via the admin action.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                KES
              </span>
              <Link
                href="/admin/orders"
                className="text-[11px] font-semibold uppercase tracking-wide text-primary hover:underline"
              >
                Open orders →
              </Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Gross
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-2xl md:text-3xl">
                {formatMoneyFromCents(data?.orders.paid.grossCents ?? 0, "KES")}
              </p>
              {data?.orders.paidTrend?.length ? (
                <div className="mt-2">
                  <Sparkline
                    points={data.orders.paidTrend}
                    tone="positive"
                    ariaLabel="Paid orders per day, last 14 days"
                  />
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                    14d · {data.orders.paidTrend.reduce(
                      (s, p) => s + p.count,
                      0,
                    )}{" "}
                    paid orders
                  </p>
                </div>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Fees
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-2xl md:text-3xl">
                {formatMoneyFromCents(data?.orders.paid.feesCents ?? 0, "KES")}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Net
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-2xl md:text-3xl">
                {formatMoneyFromCents(data?.orders.paid.netCents ?? 0, "KES")}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Refunded gross
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold tabular-nums leading-tight text-foreground sm:text-2xl md:text-3xl">
                {formatMoneyFromCents(
                  data?.orders.refunded.grossCents ?? 0,
                  "KES",
                )}
              </p>
              {data?.orders.refundedTrend?.length ? (
                <div className="mt-2">
                  <Sparkline
                    points={data.orders.refundedTrend}
                    tone="warn"
                    ariaLabel="Refunded orders per day, last 14 days"
                  />
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                    14d · {data.orders.refundedTrend.reduce(
                      (s, p) => s + p.count,
                      0,
                    )}{" "}
                    refunded
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-4 text-xs sm:grid-cols-4 sm:gap-3">
            <OrderCounter
              label="Paid"
              value={data?.orders.byStatus.PAID ?? 0}
              href="/admin/orders?status=PAID"
            />
            <OrderCounter
              label="Refunded"
              value={data?.orders.byStatus.REFUNDED ?? 0}
              href="/admin/orders?status=REFUNDED"
            />
            <OrderCounter
              label="Pending"
              value={data?.orders.byStatus.PENDING ?? 0}
              href="/admin/orders?status=PENDING"
            />
            <OrderCounter
              label="Failed"
              value={data?.orders.byStatus.FAILED ?? 0}
              href="/admin/orders?status=FAILED"
            />
          </div>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Community
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-0.5">
                Active accounts across roles.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-primary hover:underline sm:text-right"
            >
              Manage users →
            </Link>
          </div>
          <dl className="mt-4 space-y-2.5 sm:space-y-3">
            <UserCount
              label="Total accounts"
              value={data?.users.total ?? 0}
              href="/admin/users"
            />
            <UserCount
              label="Attendees"
              value={data?.users.attendees ?? 0}
              href="/admin/users?role=ATTENDEE"
            />
            <UserCount
              label="Organisers"
              value={data?.users.organizers ?? 0}
              href="/admin/users?role=ORGANIZER"
            />
            <UserCount
              label="Admins"
              value={data?.users.admins ?? 0}
              href="/admin/users?role=ADMIN"
            />
          </dl>
        </div>
      </section>

      <SubmissionTrendChart points={submissionTrend} />

      <section className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Pending review queue
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-0.5">
                Oldest submissions first — keep wait times low.
              </p>
            </div>
            <Link
              href="/admin/moderation"
              className="shrink-0 text-xs font-semibold uppercase tracking-wide text-primary hover:underline sm:text-right"
            >
              Open full queue →
            </Link>
          </div>
          {queue.length === 0 ? (
            <div className="mt-4 rounded-[var(--radius-panel)] border border-border/60 bg-wash/40 p-5 text-center text-sm leading-relaxed text-muted sm:p-6">
              Inbox zero. No events are waiting for review.
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5 sm:space-y-3">
              {queue.map((event) => (
                <PendingReviewCard key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Recent admin activity
            </h2>
          </div>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              No admin actions logged yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5 sm:space-y-3">
              {activity.map((item) => (
                <RecentActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function OrderCounter({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md py-0.5 transition-[background-color,outline-color] hover:bg-wash/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40"
      >
        {body}
      </Link>
    );
  }
  return <div className="py-0.5">{body}</div>;
}

function UserCount({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-baseline justify-between gap-3 rounded-md px-1 py-1.5 transition-[background-color,outline-color] hover:bg-wash/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40 sm:py-0.5"
      >
        {body}
      </Link>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 py-1.5 sm:py-0.5">
      {body}
    </div>
  );
}
