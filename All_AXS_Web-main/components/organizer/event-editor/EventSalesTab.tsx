"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents, normalizeOrganizerSalesSummary } from "@/lib/organizer-sales";

export function EventSalesTab({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grossCents, setGrossCents] = useState(0);
  const [feesCents, setFeesCents] = useState(0);
  const [netCents, setNetCents] = useState(0);
  const [ticketsSold, setTicketsSold] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [capacityTotal, setCapacityTotal] = useState(0);
  const [currency, setCurrency] = useState("KES");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/organizer/sales/summary");
      const normalized = normalizeOrganizerSalesSummary(res.data);
      if (!normalized) {
        setError("Unexpected sales response.");
        return;
      }
      const row = normalized.events.find((e) => e.eventId === eventId);
      if (!row) {
        setGrossCents(0);
        setFeesCents(0);
        setNetCents(0);
        setTicketsSold(0);
        setOrdersCount(0);
        setCapacityTotal(0);
        setCurrency("KES");
        return;
      }
      setGrossCents(row.grossCents);
      setFeesCents(row.feesCents);
      setNetCents(row.netCents);
      setTicketsSold(row.ticketsSold);
      setOrdersCount(row.ordersCount);
      setCapacityTotal(row.capacityTotal);
      setCurrency(row.currency);
    } catch (err) {
      if (!isAxiosError(err)) {
        setError("Could not load sales for this event.");
      } else {
        const msg = (err.response?.data as { message?: string })?.message;
        setError(msg || "Could not load sales for this event.");
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-muted">Loading sales…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">This event</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{eventTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Figures include <span className="font-medium text-foreground">paid</span> orders only.
            Capacity is the sum of tier quantities in your editor.
          </p>
        </div>
        <Button type="button" variant="secondary" className="w-auto shrink-0" onClick={() => void load()}>
          Refresh
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Gross sales</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatMoneyFromCents(grossCents, currency)}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tickets sold</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {capacityTotal > 0 ? `${ticketsSold} / ${capacityTotal}` : String(ticketsSold)}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Paid orders</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {ordersCount}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Fees (platform)</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatMoneyFromCents(feesCents, currency)}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Net (organizer)</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatMoneyFromCents(netCents, currency)}
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-border bg-background/80 p-5 sm:p-6">
        <p className="text-sm text-muted">
          Open the full order log with filters and pagination on the{" "}
          <Link
            href={`/organizer/sales?event=${encodeURIComponent(eventId)}`}
            className="font-semibold text-primary hover:underline"
          >
            Sales &amp; orders
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
