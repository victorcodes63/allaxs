"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import type { AdminPayoutBatchesListPayload, PayoutBatchRow } from "@/lib/organizer-earnings";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

function parseOrganizerIds(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<AdminPayoutBatchesListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [idsInput, setIdsInput] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<AdminPayoutBatchesListPayload>("/api/admin/payout-batches?limit=30");
      setData(res.data);
    } catch (e) {
      if (!isAxiosError(e)) setError("Could not load batches.");
      else {
        const msg = (e.response?.data as { message?: string })?.message;
        setError(msg || "Could not load batches.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft() {
    const organizerIds = parseOrganizerIds(idsInput);
    if (!organizerIds.length) {
      setError("Enter at least one organizer profile UUID.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await axios.post("/api/admin/payout-batches", { organizerIds });
      setIdsInput("");
      await load();
    } catch (e) {
      if (!isAxiosError(e)) setError("Create failed.");
      else {
        const msg = (e.response?.data as { message?: string | string[] })?.message;
        setError(
          Array.isArray(msg) ? msg.join(", ") : msg || "Create failed.",
        );
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={ADMIN_PAGE_SHELL}>
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Finance</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Payout batches
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Draft batches reserve each organizer&apos;s available balance. After your bank run, mark paid
          to post payout lines to ledgers.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">New draft</h2>
        <p className="mt-1 text-xs text-muted">
          Organizer profile IDs (comma or newline separated). Use the UUID from orders filters or the
          database.
        </p>
        <textarea
          className="mt-3 w-full min-h-[5rem] rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="e.g. 8b2c…, 3a91…"
          value={idsInput}
          onChange={(e) => setIdsInput(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" className="w-auto" disabled={creating} onClick={() => void createDraft()}>
            {creating ? "Creating…" : "Create draft batch"}
          </Button>
          <Button type="button" variant="secondary" className="w-auto" onClick={() => void load()}>
            Refresh list
          </Button>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data && data.batches.length === 0 ? (
        <p className="text-sm text-muted">No payout batches yet.</p>
      ) : null}

      {data && data.batches.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {data.batches.map((b: PayoutBatchRow) => (
                <tr key={b.id} className="text-foreground">
                  <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase">{b.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoneyFromCents(b.totalCents, b.currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">{b.lines?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/payouts/${b.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
