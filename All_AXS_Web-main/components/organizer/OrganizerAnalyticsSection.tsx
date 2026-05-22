"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import axios, { isAxiosError } from "axios";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  formatPercent,
  normalizeOrganizerAnalyticsSummary,
  type OrganizerAnalyticsSummary,
} from "@/lib/organizer-analytics";

function DailySalesChart({
  points,
  currency,
}: {
  points: OrganizerAnalyticsSummary["dailySales"];
  currency: string;
}) {
  const maxGross = Math.max(1, ...points.map((p) => p.grossCents));
  const totalGross = points.reduce((sum, p) => sum + p.grossCents, 0);
  const totalOrders = points.reduce((sum, p) => sum + p.count, 0);
  const peak = points.find((p) => p.grossCents === maxGross && p.grossCents > 0);

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Sales over time
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:mt-0.5">
            Daily paid order gross for the last 14 days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
          <span className="rounded-full border border-border/70 bg-wash/50 px-2.5 py-0.5">
            {formatMoneyFromCents(totalGross, currency)} gross
          </span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-primary">
            {totalOrders} orders
          </span>
          {peak ? (
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-emerald-100">
              Peak {formatMoneyFromCents(peak.grossCents, currency)}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className="mt-5 flex h-28 items-end gap-1 sm:h-32 sm:gap-1.5"
        role="img"
        aria-label="Daily gross sales for the last 14 days"
      >
        {points.map((point) => {
          const heightPct = Math.max(4, (point.grossCents / maxGross) * 100);
          const label = new Date(`${point.date}T12:00:00.000Z`).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" },
          );
          return (
            <div
              key={point.date}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${label}: ${formatMoneyFromCents(point.grossCents, currency)} (${point.count} orders)`}
            >
              <div
                className="w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${heightPct}%` }}
              />
              <span className="hidden text-[9px] tabular-nums text-muted sm:block">
                {label.replace(/,?\s*\d{4}$/, "")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OrganizerAnalyticsSection({
  eventId,
  eventLabel,
}: {
  eventId?: string;
  eventLabel?: string;
}): ReactElement {
  const [data, setData] = useState<OrganizerAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
      const res = await axios.get<unknown>(`/api/organizer/analytics/summary${qs}`);
      const normalized = normalizeOrganizerAnalyticsSummary(res.data);
      if (!normalized) {
        setError("Unexpected response from analytics summary.");
        setData(null);
        return;
      }
      setData(normalized);
    } catch (err) {
      if (!isAxiosError(err)) {
        setError("Could not load analytics.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("Network error — check your connection and try again.");
      } else {
        const msg = (err.response.data as { message?: string })?.message;
        setError(msg || "Could not load analytics.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const scopeLabel = useMemo(
    () => eventLabel ?? (eventId ? "Selected event" : "All events"),
    [eventId, eventLabel],
  );

  if (loading) {
    return (
      <section aria-labelledby="analytics-heading" className="space-y-4">
        <h2
          id="analytics-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Funnel analytics
        </h2>
        <p className="text-sm text-muted">Loading analytics…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="analytics-heading" className="space-y-4">
        <h2
          id="analytics-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Funnel analytics
        </h2>
        <div
          className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="font-semibold text-foreground underline decoration-amber-200/40 underline-offset-2 hover:decoration-foreground"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) return <></>;

  const paidTrendTotal = data.dailySales.reduce((s, p) => s + p.count, 0);

  return (
    <section aria-labelledby="analytics-heading" className="space-y-4">
      <div className="space-y-1">
        <h2
          id="analytics-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Funnel analytics
        </h2>
        <p className="text-xs text-muted">
          Metrics for <span className="font-medium text-foreground">{scopeLabel}</span>.
          Conversion is paid checkouts divided by all non-draft orders; refund rate is
          refunds among settled (paid + refunded) orders.
        </p>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Paid orders
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {data.paid.count}
            </p>
            {data.dailySales.length ? (
              <div className="mt-2">
                <Sparkline
                  points={data.dailySales}
                  tone="positive"
                  ariaLabel="Paid orders per day, last 14 days"
                />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                  14d · {paidTrendTotal} paid
                </p>
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Gross sales
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {formatMoneyFromCents(data.paid.grossCents, data.currency)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Conversion
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {formatPercent(data.conversionRate)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
              Paid / checkout attempts
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Refunds
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
              {data.refunded.count}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatPercent(data.refunded.rate)} rate ·{" "}
              {formatMoneyFromCents(data.refunded.grossCents, data.currency)} gross
            </p>
          </div>
        </div>
      </div>

      {data.dailySales.length ? (
        <DailySalesChart points={data.dailySales} currency={data.currency} />
      ) : null}
    </section>
  );
}
