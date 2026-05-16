"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import {
  formatMoneyFromCents,
  formatShortDateTime,
  normalizeOrganizerSalesOrders,
  normalizeOrganizerSalesSummary,
  type OrganizerSalesEventRow,
  type OrganizerSalesOrderRow,
  type OrganizerSalesRollup,
} from "@/lib/organizer-sales";
import { organizerEventStatusChipClass } from "@/lib/organizer-event-status-chip";

const PAGE_SIZE = 25;

function RollupTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function OrganizerSalesContent(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get("event") ?? "";

  const [rollup, setRollup] = useState<OrganizerSalesRollup | null>(null);
  const [eventRows, setEventRows] = useState<OrganizerSalesEventRow[]>([]);
  const [orders, setOrders] = useState<OrganizerSalesOrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterEventId, setFilterEventId] = useState(eventFromUrl);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/organizer/sales/summary");
      const normalized = normalizeOrganizerSalesSummary(res.data);
      if (!normalized) {
        setError("Unexpected response from sales summary.");
        setRollup(null);
        setEventRows([]);
        return;
      }
      setRollup(normalized.rollup);
      setEventRows(normalized.events);
    } catch (err) {
      if (!isAxiosError(err)) {
        setError("Could not load sales summary.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("Network error — check your connection and try again.");
      } else {
        const msg = (err.response.data as { message?: string })?.message;
        setError(msg || "Could not load sales summary.");
      }
      setRollup(null);
      setEventRows([]);
    }
  }, []);

  const loadOrders = useCallback(async (eventId: string, pageIndex: number) => {
    setOrdersError(null);
    setOrdersLoading(true);
    const offset = pageIndex * PAGE_SIZE;
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (eventId) qs.set("eventId", eventId);
      const res = await axios.get<unknown>(`/api/organizer/sales/orders?${qs.toString()}`);
      const normalized = normalizeOrganizerSalesOrders(res.data);
      if (!normalized) {
        setOrdersError("Unexpected response from orders.");
        setOrders([]);
        setOrdersTotal(0);
        return;
      }
      setOrders(normalized.orders);
      setOrdersTotal(normalized.total);
    } catch (err) {
      if (!isAxiosError(err)) {
        setOrdersError("Could not load orders.");
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setOrdersError("Network error — check your connection and try again.");
      } else {
        const status = err.response.status;
        const msg = (err.response.data as { message?: string })?.message;
        if (status === 403) {
          setOrdersError(msg || "You do not have access to orders for that event.");
        } else {
          setOrdersError(msg || "Could not load orders.");
        }
      }
      setOrders([]);
      setOrdersTotal(0);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadSummary();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  useEffect(() => {
    void loadOrders(filterEventId, page);
  }, [filterEventId, page, loadOrders]);

  useEffect(() => {
    setFilterEventId(eventFromUrl);
    setPage(0);
  }, [eventFromUrl]);

  const filterLabel = useMemo(() => {
    if (!filterEventId) return "All events";
    const row = eventRows.find((e) => e.eventId === filterEventId);
    return row?.title ?? "Selected event";
  }, [filterEventId, eventRows]);

  const maxPage = Math.max(0, Math.ceil(ordersTotal / PAGE_SIZE) - 1);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading sales…</p>
        <p className="text-xs text-muted">Summary and ticket performance</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organiser</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Sales &amp; orders
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Paid orders and ticket counts across your events. Gross totals reflect checkout amounts;
              platform fees (if any) are shown separately. Payout banking is managed from your organizer
              profile.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/organizer/account">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Payout profile
                </Button>
              </Link>
              <Link href="/organizer/events">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Manage events
                </Button>
              </Link>
            </div>
          </div>
          <aside className="w-full shrink-0 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] lg:max-w-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Money flow</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Ticket revenue settles according to your contract. See{" "}
              <Link href="/organizer/earnings" className="font-medium text-primary hover:underline">
                Earnings
              </Link>{" "}
              for ledger balance and payout reservations; keep payout instructions accurate in{" "}
              <Link href="/organizer/account" className="font-medium text-primary hover:underline">
                Account
              </Link>
              .
            </p>
          </aside>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="font-semibold text-foreground underline decoration-red-200/40 underline-offset-2 hover:decoration-foreground"
          >
            Retry
          </button>
        </div>
      ) : null}

      {rollup ? (
        <section aria-labelledby="sales-rollup-heading">
          <h2
            id="sales-rollup-heading"
            className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50 sm:mb-4"
          >
            All events (paid orders)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 sm:gap-4">
            <RollupTile
              label="Gross sales"
              value={formatMoneyFromCents(rollup.grossCents, rollup.currency)}
              hint="Sum of paid order totals (buyer checkout amounts)."
            />
            <RollupTile
              label="Tickets sold"
              value={String(rollup.ticketsSold)}
              hint="Tickets across paid orders."
            />
            <RollupTile
              label="Paid orders"
              value={String(rollup.ordersCount)}
              hint="Successful checkouts only."
            />
            <RollupTile
              label="Fees (platform)"
              value={formatMoneyFromCents(rollup.feesCents, rollup.currency)}
              hint="All AXS share recorded per order."
            />
            <RollupTile
              label="Net (organizer)"
              value={formatMoneyFromCents(rollup.netCents, rollup.currency)}
              hint="Gross sales minus platform fees."
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="per-event-heading" className="space-y-4">
        <h2 id="per-event-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Per event
        </h2>
        {eventRows.length === 0 ? (
          <p className="text-sm text-muted">
            Create and publish an event with ticket tiers to start seeing sales here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Sold / cap</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/40">
                {eventRows.map((row) => {
                  const capLabel =
                    row.capacityTotal > 0
                      ? `${row.ticketsSold} / ${row.capacityTotal}`
                      : `${row.ticketsSold}`;
                  return (
                    <tr key={row.eventId} className="text-foreground">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted tabular-nums">{formatShortDateTime(row.startAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${organizerEventStatusChipClass(
                            row.status,
                          )}`}
                        >
                          {row.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{capLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.ordersCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMoneyFromCents(row.grossCents, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {formatMoneyFromCents(row.feesCents, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMoneyFromCents(row.netCents, row.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                          <Link
                            href={`/organizer/sales?event=${encodeURIComponent(row.eventId)}`}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Orders
                          </Link>
                          <Link
                            href={`/organizer/tickets?event=${encodeURIComponent(row.eventId)}`}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Passes
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="orders-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="orders-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
            Order log
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-medium text-muted" htmlFor="sales-event-filter">
              Filter
            </label>
            <select
              id="sales-event-filter"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              value={filterEventId}
              onChange={(e) => {
                const v = e.target.value;
                setPage(0);
                setFilterEventId(v);
                if (v) {
                  router.replace(`/organizer/sales?event=${encodeURIComponent(v)}`);
                } else {
                  router.replace("/organizer/sales");
                }
              }}
            >
              <option value="">All events</option>
              {eventRows.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">
          Showing orders for <span className="font-medium text-foreground">{filterLabel}</span>.
        </p>

        {ordersError ? (
          <div
            className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            role="alert"
          >
            {ordersError}
          </div>
        ) : null}

        {ordersLoading ? (
          <p className="text-sm text-muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet for this selection.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Line items</th>
                  <th className="px-4 py-3 text-right">Tickets</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/40">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top text-foreground">
                    <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                      {formatShortDateTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[10rem] truncate font-medium">{o.eventTitle}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[12rem] truncate text-sm">{o.buyerEmail}</div>
                      {o.buyerName ? (
                        <div className="max-w-[12rem] truncate text-xs text-muted">{o.buyerName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted max-w-xs">{o.lineSummary}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.ticketsInOrder}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatMoneyFromCents(o.amountCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {formatMoneyFromCents(o.feesCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatMoneyFromCents(o.netCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-muted">{o.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ordersTotal > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4 text-sm">
            <p className="text-muted">
              Page <span className="font-medium text-foreground">{page + 1}</span> of{" "}
              <span className="font-medium text-foreground">{maxPage + 1}</span> ·{" "}
              <span className="tabular-nums">{ordersTotal}</span> orders
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-auto"
                disabled={page <= 0 || ordersLoading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-auto"
                disabled={page >= maxPage || ordersLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
