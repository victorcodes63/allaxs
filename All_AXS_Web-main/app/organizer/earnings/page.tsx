"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import type {
  OrganizerEarningsLedgerPayload,
  OrganizerEarningsSummary,
} from "@/lib/organizer-earnings";

function BalanceTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-5",
        accent ? "border-primary/25 bg-primary/[0.06]" : "",
      ].join(" ")}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export default function OrganizerEarningsPage() {
  const [summary, setSummary] = useState<OrganizerEarningsSummary | null>(null);
  const [ledger, setLedger] = useState<OrganizerEarningsLedgerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, ledRes] = await Promise.all([
        axios.get<OrganizerEarningsSummary>("/api/organizer/earnings/summary"),
        axios.get<OrganizerEarningsLedgerPayload>("/api/organizer/earnings/ledger?limit=50&offset=0"),
      ]);
      setSummary(sumRes.data);
      setLedger(ledRes.data);
    } catch (e) {
      if (!isAxiosError(e)) {
        setError("Could not load earnings.");
      } else {
        const msg = (e.response?.data as { message?: string })?.message;
        setError(msg || "Could not load earnings.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading earnings…</p>
        <p className="text-xs text-muted">Ledger and available balance</p>
      </div>
    );
  }

  const cur = summary?.currency ?? "KES";

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organiser</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Earnings &amp; payouts
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Balances follow ticket sales minus platform fees. Amounts reserved in an open payout batch
              are not available until that batch is cancelled or marked paid (after your bank run).
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/organizer/sales">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Sales &amp; orders
                </Button>
              </Link>
              <Link href="/organizer/account">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Payout profile
                </Button>
              </Link>
            </div>
          </div>
          <aside className="w-full shrink-0 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] lg:max-w-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Settlements</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your <span className="font-medium text-foreground/90">ledger</span> is the running total from
              sales and refunds. <span className="font-medium text-foreground/90">Reserved</span> is money
              included in a draft or approved payout batch until it is paid or cancelled. Need ticket
              detail? Open{" "}
              <Link href="/organizer/sales" className="font-medium text-primary hover:underline">
                Sales &amp; orders
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
            className="font-semibold text-foreground underline decoration-red-200/40 underline-offset-2 hover:decoration-foreground"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {summary ? (
        <section aria-labelledby="earnings-balance-heading">
          <h2
            id="earnings-balance-heading"
            className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50 sm:mb-4"
          >
            Balance summary
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <BalanceTile
              label="Ledger balance"
              value={formatMoneyFromCents(summary.ledgerNetCents, cur)}
              hint="Net ticket revenue recorded on your ledger (after platform fees)."
            />
            <BalanceTile
              label="Reserved (open batches)"
              value={formatMoneyFromCents(summary.reservedInOpenBatchesCents, cur)}
              hint="Held for payout batches that are not yet marked paid."
            />
            <BalanceTile
              label="Available"
              value={formatMoneyFromCents(summary.availableCents, cur)}
              hint="What you can include in the next payout batch."
              accent
            />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="earnings-ledger-heading">
        <h2
          id="earnings-ledger-heading"
          className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50 sm:mb-4"
        >
          Ledger
        </h2>
        {ledger && ledger.entries.length === 0 ? (
          <p className="text-sm text-muted">No ledger activity yet.</p>
        ) : null}
        {ledger && ledger.entries.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/40">
                {ledger.entries.map((row) => (
                  <tr key={row.id} className="align-top text-foreground">
                    <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{row.entryTypeLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {row.orderId ? `${row.orderId.slice(0, 8)}…` : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        row.amountCents < 0 ? "text-primary" : ""
                      }`}
                    >
                      {row.amountCents >= 0 ? "+" : ""}
                      {formatMoneyFromCents(row.amountCents, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
