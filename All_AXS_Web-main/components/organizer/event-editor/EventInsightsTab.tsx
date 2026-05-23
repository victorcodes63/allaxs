"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  normalizeEventInsights,
  type EventInsightsPayload,
} from "@/lib/organizer-insights";

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoFromDateInput(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  if (endOfDay) {
    dt.setHours(23, 59, 59, 999);
  } else {
    dt.setHours(0, 0, 0, 0);
  }
  return dt.toISOString();
}

function pct(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function EventInsightsTab({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(todayDateInput);
  const [data, setData] = useState<EventInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ eventId });
      const fromIso = isoFromDateInput(from);
      const toIso = isoFromDateInput(to, true);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      const res = await axios.get<unknown>(
        `/api/organizer/analytics/insights?${params.toString()}`,
      );
      const normalized = normalizeEventInsights(res.data);
      if (!normalized) {
        setError("Insights API returned an unexpected shape.");
        setData(null);
        return;
      }
      setData(normalized);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load insights for this event.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedTiers = useMemo(
    () =>
      data
        ? [...data.tiers].sort((a, b) => b.grossCents - a.grossCents)
        : [],
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Insights for
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            {eventTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Tier revenue, scan rate, traffic sources, and a sales timeline. Pick a
            date range that matches the campaign window you want to study.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
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

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            <StatTile
              label="Total revenue"
              value={formatMoneyFromCents(data.totalRevenueCents, data.currency)}
              hint="Gross from paid orders in the selected window."
            />
            <StatTile
              label="Net (organizer)"
              value={formatMoneyFromCents(data.totalNetCents, data.currency)}
              hint="Revenue after platform fees."
            />
            <StatTile
              label="Tickets issued"
              value={String(data.totalIssued)}
              hint="Across paid orders in the window."
            />
            <StatTile
              label="Scan rate"
              value={pct(data.scanRate)}
              hint={`${data.scanned} scanned of ${data.totalIssued} issued.`}
            />
          </div>

          <section aria-labelledby="tiers-heading">
            <h3
              id="tiers-heading"
              className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Tier revenue breakdown
            </h3>
            {sortedTiers.length === 0 ? (
              <p className="text-sm text-muted">No tier sales in this range.</p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3 text-right">Sold / capacity</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                      <th className="px-4 py-3 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/40">
                    {sortedTiers.map((row) => (
                      <tr key={row.tierId} className="text-foreground">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.ticketsSold}
                          {row.capacity > 0 ? ` / ${row.capacity}` : ""}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoneyFromCents(row.grossCents, row.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoneyFromCents(row.netCents, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="traffic-heading">
            <h3
              id="traffic-heading"
              className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              Traffic sources
            </h3>
            {data.trafficSources.length === 0 ? (
              <p className="text-sm text-muted">
                No traffic data yet. Add UTM parameters to your share links to start
                attributing sales to sources.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Visits</th>
                      <th className="px-4 py-3 text-right">Conversions</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/40">
                    {data.trafficSources.map((row) => (
                      <tr key={row.source} className="text-foreground">
                        <td className="px-4 py-3 font-medium">{row.source}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.visits}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.conversions}
                          {row.visits > 0
                            ? ` (${pct(row.conversions / row.visits)})`
                            : ""}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoneyFromCents(row.revenueCents, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {data.timeline.length > 0 ? (
            <section aria-labelledby="timeline-heading">
              <h3
                id="timeline-heading"
                className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
              >
                Daily sales
              </h3>
              <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Tickets</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/40">
                    {data.timeline.map((row) => (
                      <tr key={row.date} className="text-foreground">
                        <td className="px-4 py-3 tabular-nums text-muted">{row.date}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.ticketsSold}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoneyFromCents(row.grossCents, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
