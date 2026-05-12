"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { EventReviewActions } from "@/components/admin/EventReviewActions";
import { EventStatus } from "@/lib/validation/event";
import {
  getEventBannerUrl,
  shouldUnoptimizeEventImage,
} from "@/lib/utils/image";

interface AdminTicketType {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  status?: string;
  salesStart?: string | null;
  salesEnd?: string | null;
}

interface AdminEvent {
  id: string;
  title: string;
  slug?: string | null;
  description?: string;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  city?: string;
  country?: string;
  startAt: string;
  endAt: string;
  status: string;
  bannerUrl?: string | null;
  ticketTypes?: AdminTicketType[];
  createdAt: string;
  metadata?: {
    rejectionReason?: string;
  };
  organizer: {
    id: string;
    orgName: string;
    user?: {
      id: string;
      email: string;
      name?: string;
    };
  };
}

interface OrdersSummary {
  eventId: string;
  currency: string;
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
}

interface AuditEntry {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  admin: { id: string; email: string; name?: string | null } | null;
}

const PAGE_PADDING =
  "mx-auto w-full max-w-[min(100%,1400px)] px-4 sm:px-6 lg:px-8";

function statusChipClass(status: string): string {
  switch (status) {
    case EventStatus.PENDING_REVIEW:
      return "border-amber-400/25 bg-amber-500/15 text-amber-100";
    case EventStatus.PUBLISHED:
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case EventStatus.APPROVED:
      return "border-sky-400/25 bg-sky-500/15 text-sky-100";
    case EventStatus.REJECTED:
      return "border-red-400/30 bg-red-500/12 text-red-100";
    case EventStatus.ARCHIVED:
      return "border-white/10 bg-white/[0.04] text-muted";
    default:
      return "border-white/10 bg-white/[0.06] text-foreground/85";
  }
}

function tierStatusChipClass(status?: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case "PAUSED":
      return "border-amber-400/25 bg-amber-500/15 text-amber-100";
    case "ARCHIVED":
      return "border-white/10 bg-white/[0.04] text-muted";
    default:
      return "border-white/10 bg-white/[0.06] text-foreground/85";
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

function formatDateShort(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function typeLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    APPROVE_EVENT: "Approved event",
    REJECT_EVENT: "Rejected event",
    REFUND_ORDER: "Refunded order",
    UPDATE_USER_ROLES: "Updated user roles",
    ADMIN_PING: "Pinged admin",
  };
  if (map[action]) return map[action];
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (l) => l.toUpperCase());
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-foreground/90">
        {value}
      </dd>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warn";
  href?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "border-red-400/25 bg-red-500/10"
      : "border-border/70 bg-surface/85";
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const baseClass = `rounded-[var(--radius-panel)] border ${toneClass} p-4`;
  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} block transition-[border-color,box-shadow] hover:border-primary/35`}
      >
        {body}
      </Link>
    );
  }
  return <div className={baseClass}>{body}</div>;
}

function TicketTierCard({ tier }: { tier: AdminTicketType }) {
  const sold = tier.quantitySold ?? 0;
  const total = tier.quantityTotal ?? 0;
  const remaining = Math.max(0, total - sold);
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const window = [tier.salesStart, tier.salesEnd]
    .filter((v): v is string => Boolean(v))
    .map(formatDateShort);
  const windowLabel =
    window.length === 2
      ? `${window[0]} → ${window[1]}`
      : window.length === 1
        ? tier.salesStart
          ? `From ${window[0]}`
          : `Until ${window[0]}`
        : "Always on sale";

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-foreground">
            {tier.name}
          </p>
          {tier.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted">
              {tier.description}
            </p>
          ) : null}
        </div>
        {tier.status ? (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierStatusChipClass(
              tier.status,
            )}`}
          >
            {tier.status.toLowerCase()}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-semibold tabular-nums text-foreground">
          {formatCents(tier.priceCents, tier.currency)}
        </span>
        <span className="text-xs text-muted">
          {sold}/{total} sold · {remaining} left
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {windowLabel}
      </p>
    </div>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const meta = entry.metadata ?? {};
  const reason =
    typeof (meta as { reason?: unknown }).reason === "string"
      ? ((meta as { reason: string }).reason)
      : null;
  const previousStatus =
    typeof (meta as { previousStatus?: unknown }).previousStatus === "string"
      ? ((meta as { previousStatus: string }).previousStatus)
      : null;
  const newStatus =
    typeof (meta as { newStatus?: unknown }).newStatus === "string"
      ? ((meta as { newStatus: string }).newStatus)
      : null;

  return (
    <li className="flex flex-col gap-1 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {actionLabel(entry.action)}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {formatDate(entry.createdAt)}
        </p>
      </div>
      <p className="text-xs text-muted">
        {entry.admin?.name || entry.admin?.email || "System"}
        {previousStatus && newStatus ? (
          <>
            {" · "}
            <span className="text-foreground/80">{previousStatus}</span>
            {" → "}
            <span className="text-foreground/80">{newStatus}</span>
          </>
        ) : null}
        {entry.status === "FAILURE" ? (
          <span className="ml-2 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-100">
            failed
          </span>
        ) : null}
      </p>
      {reason ? (
        <p className="text-xs italic text-foreground/80">“{reason}”</p>
      ) : null}
    </li>
  );
}

export default function AdminEventInspectPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [orders, setOrders] = useState<OrdersSummary | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventRes, ordersRes, auditRes] = await Promise.allSettled([
        axios.get<AdminEvent>(`/api/admin/events/${eventId}`),
        axios.get<OrdersSummary>(
          `/api/admin/events/${eventId}/orders-summary`,
        ),
        axios.get<AuditEntry[]>(`/api/admin/events/${eventId}/audit`),
      ]);

      if (eventRes.status === "fulfilled") {
        setEvent(eventRes.value.data);
      } else {
        const err = eventRes.reason;
        const message = isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message ||
            err.message
          : "Failed to load event.";
        setError(message);
        setEvent(null);
      }

      setOrders(
        ordersRes.status === "fulfilled" ? ordersRes.value.data : null,
      );
      setAudit(auditRes.status === "fulfilled" ? auditRes.value.data : []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) void load();
  }, [eventId, load]);

  if (loading) {
    return (
      <main className={`${PAGE_PADDING} py-10`}>
        <p className="text-sm text-muted">Loading event…</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className={`${PAGE_PADDING} space-y-4 py-10`}>
        <Link
          href="/admin/events"
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to all events
        </Link>
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error || "Event not found."}
        </div>
      </main>
    );
  }

  const bannerSrc = event.bannerUrl ? getEventBannerUrl(event.bannerUrl) : null;
  const isPending = event.status === EventStatus.PENDING_REVIEW;
  const isLive = event.status === EventStatus.PUBLISHED && event.slug;
  const venueLine =
    [event.venue, event.city, event.country].filter(Boolean).join(" · ") || "—";
  const tiers = event.ticketTypes ?? [];
  const currency = orders?.currency ?? tiers[0]?.currency ?? "KES";
  const paidCount = orders?.paid.count ?? 0;
  const grossCents = orders?.paid.grossCents ?? 0;
  const netCents = orders?.paid.netCents ?? 0;
  const refundedCount = orders?.refunded.count ?? 0;
  const refundedCents = orders?.refunded.grossCents ?? 0;

  return (
    <main className={`${PAGE_PADDING} space-y-6 py-6 md:py-8`}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/events"
            className="text-sm text-muted hover:text-foreground"
          >
            ← Back to all events
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {event.title}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(
                event.status,
              )}`}
            >
              {event.status.replace(/_/g, " ")}
            </span>
            <span className="rounded-full border border-border/70 bg-wash/60 px-2.5 py-0.5 text-[10px] font-medium text-muted">
              {typeLabel(event.type)}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Admin-only event inspection across every platform status. This page
            does not depend on the moderation queue filter.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          {isPending ? (
            <EventReviewActions
              event={event}
              onActionComplete={() => void load()}
            />
          ) : null}
          {isLive ? (
            <Link
              href={`/events/${event.slug}`}
              target="_blank"
              rel="noopener"
            >
              <Button type="button" variant="secondary" className="w-auto">
                View live
              </Button>
            </Link>
          ) : null}
          {/*
            Edit-as-admin route is intentionally always available (any status,
            any organiser). Audit-logged via ADMIN_UPDATE_EVENT.
          */}
          <Link href={`/admin/events/${event.id}/edit` as const}>
            <Button type="button" variant="secondary" className="w-auto">
              Edit as admin
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div className="space-y-6">
          <div className="relative h-72 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-wash md:h-96">
            {bannerSrc ? (
              <Image
                src={bannerSrc}
                alt=""
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 60vw, 100vw"
                unoptimized={shouldUnoptimizeEventImage(bannerSrc)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-muted">
                No banner
              </div>
            )}
          </div>

          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Description
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
              {event.description || "No description has been added."}
            </p>
          </div>

          {event.metadata?.rejectionReason ? (
            <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-100/80">
                Previous rejection reason
              </p>
              <p className="mt-1">{event.metadata.rejectionReason}</p>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <dl className="grid grid-cols-1 gap-3">
            <DetailItem label="Organiser" value={event.organizer.orgName} />
            <DetailItem
              label="Organiser email"
              value={event.organizer.user?.email || "—"}
            />
            <DetailItem label="Starts" value={formatDate(event.startAt)} />
            <DetailItem label="Ends" value={formatDate(event.endAt)} />
            <DetailItem label="Venue" value={venueLine} />
            <DetailItem
              label="Ticket tiers"
              value={`${tiers.length} configured`}
            />
            <DetailItem label="Submitted" value={formatDate(event.createdAt)} />
          </dl>
        </aside>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Ticket tiers
          </h2>
          <p className="text-xs text-muted">
            {tiers.length} configured · sold figures from latest sync
          </p>
        </div>
        {tiers.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No tiers configured for this event yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <TicketTierCard key={tier.id} tier={tier} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Revenue summary
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Tiles link through to the filtered orders view.
            </p>
          </div>
          <p className="text-xs text-muted">
            Currency: <span className="text-foreground/85">{currency}</span>
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Paid orders"
            value={paidCount}
            hint={
              orders
                ? `${Object.entries(orders.byStatus)
                    .filter(([s]) => s !== "PAID" && s !== "REFUNDED")
                    .reduce((sum, [, c]) => sum + c, 0)} in other states`
                : "—"
            }
            href={`/admin/orders?eventId=${event.id}&status=PAID`}
          />
          <KpiTile
            label="Gross paid"
            value={formatCents(grossCents, currency)}
            hint="Sum of paid amount cents"
            href={`/admin/orders?eventId=${event.id}&status=PAID`}
          />
          <KpiTile
            label="Net (after fees)"
            value={formatCents(netCents, currency)}
            hint={
              orders
                ? `Fees ${formatCents(orders.paid.feesCents, currency)}`
                : undefined
            }
            href={`/admin/orders?eventId=${event.id}`}
          />
          <KpiTile
            label="Refunded"
            value={`${refundedCount} · ${formatCents(refundedCents, currency)}`}
            tone={refundedCount > 0 ? "warn" : "default"}
            href={`/admin/orders?eventId=${event.id}&status=REFUNDED`}
          />
        </div>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Moderation history
          </h2>
          <p className="text-xs text-muted">
            {audit.length} {audit.length === 1 ? "entry" : "entries"}
          </p>
        </div>
        {audit.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No admin actions recorded for this event yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {audit.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
