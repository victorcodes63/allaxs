"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import type { PayoutBatchRow } from "@/lib/organizer-earnings";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

type BatchDetailResponse = { batch: PayoutBatchRow };

export default function AdminPayoutBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [batch, setBatch] = useState<PayoutBatchRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refInput, setRefInput] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<BatchDetailResponse>(`/api/admin/payout-batches/${id}`);
      setBatch(res.data.batch);
    } catch (e) {
      if (!isAxiosError(e)) setError("Could not load batch.");
      else {
        const msg = (e.response?.data as { message?: string })?.message;
        setError(msg || "Could not load batch.");
      }
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await axios.post<BatchDetailResponse>(path, body ?? {});
      setBatch(res.data.batch);
    } catch (e) {
      if (!isAxiosError(e)) setError("Action failed.");
      else {
        const msg = (e.response?.data as { message?: string | string[] })?.message;
        setError(Array.isArray(msg) ? msg.join(", ") : msg || "Action failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!id) {
    return (
      <div className={ADMIN_PAGE_SHELL}>
        <p className="text-sm text-muted">Missing batch id.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={ADMIN_PAGE_SHELL}>
        <p className="text-sm text-muted">Loading batch…</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className={ADMIN_PAGE_SHELL}>
        <p className="text-sm text-primary">{error || "Not found."}</p>
        <Link href="/admin/payouts" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to payouts
        </Link>
      </div>
    );
  }

  const st = batch.status;
  const canApprove = st === "DRAFT";
  const canExport = st === "APPROVED";
  const canMarkPaid = st === "APPROVED" || st === "EXPORTED";
  const canCancel = st === "DRAFT" || st === "APPROVED" || st === "EXPORTED";

  return (
    <div className={ADMIN_PAGE_SHELL}>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/payouts" className="text-sm text-muted hover:text-foreground">
          ← Payout batches
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Batch <span className="font-mono text-lg">{batch.id.slice(0, 8)}…</span>
        </h1>
        <p className="text-sm text-muted">
          Status: <span className="font-medium text-foreground">{st}</span>
          {batch.externalReference ? (
            <>
              {" "}
              · Reference:{" "}
              <span className="font-mono text-foreground">{batch.externalReference}</span>
            </>
          ) : null}
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="w-auto"
          disabled={!canApprove || busy}
          onClick={() => void postAction(`/api/admin/payout-batches/${id}/approve`)}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          disabled={!canExport || busy}
          onClick={() => void postAction(`/api/admin/payout-batches/${id}/export`)}
        >
          Mark exported
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          disabled={!canCancel || busy}
          onClick={() => void postAction(`/api/admin/payout-batches/${id}/cancel`)}
        >
          Cancel
        </Button>
      </div>

      {canMarkPaid ? (
        <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">Mark paid</h2>
          <p className="mt-1 text-xs text-muted">
            Posts negative ledger entries for each line and closes the batch. Use after funds have left
            your bank / Paystack balance.
          </p>
          <input
            type="text"
            className="mt-3 w-full max-w-md rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Bank or finance reference"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
          />
          <div className="mt-3">
            <Button
              type="button"
              className="w-auto"
              disabled={busy || !refInput.trim()}
              onClick={() =>
                void postAction(`/api/admin/payout-batches/${id}/mark-paid`, {
                  externalReference: refInput.trim(),
                })
              }
            >
              Mark paid
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Organizer</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/40">
            {(batch.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{line.orgName ?? "—"}</div>
                  <div className="font-mono text-xs text-muted">{line.organizerId}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatMoneyFromCents(line.amountCents, line.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {st === "MARKED_PAID" ? (
        <p className="text-sm text-muted">
          This batch is closed.{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => router.push("/admin/payouts")}
          >
            Return to list
          </button>
        </p>
      ) : null}
    </div>
  );
}
