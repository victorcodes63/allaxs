"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  normalizePayoutRequests,
  normalizePayoutSummary,
  payoutStatusChipClass,
  payoutStatusLabel,
  type PayoutRequest,
  type PayoutSummary,
} from "@/lib/organizer-payouts";

function inputDollarsToCents(amount: string): number | null {
  const trimmed = amount.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function OrganizerWithdrawPanel() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, reqRes] = await Promise.all([
        axios.get<unknown>("/api/organizer/payouts/summary"),
        axios.get<unknown>("/api/organizer/payouts/requests?limit=50"),
      ]);
      setSummary(normalizePayoutSummary(sumRes.data));
      setRequests(normalizePayoutRequests(reqRes.data).requests);
    } catch (err) {
      if (!isAxiosError(err)) {
        setError("Could not load payout details.");
      } else if (err.response?.status === 404) {
        // Endpoint not enabled yet — silently keep panel as info-only.
        setSummary(null);
        setRequests([]);
      } else {
        const msg = (err.response?.data as { message?: string })?.message;
        setError(msg || "Could not load payout details.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingRequest = useMemo(
    () =>
      requests.find(
        (r) =>
          r.status === "PENDING" ||
          r.status === "APPROVED" ||
          r.status === "PROCESSING",
      ) ?? null,
    [requests],
  );

  const currency = summary?.currency ?? "USD";
  const availableCents = summary?.availableCents ?? 0;
  const minCents = summary?.minWithdrawalCents ?? 0;

  const validateAndOpenConfirm = () => {
    setFormError(null);
    setSuccess(null);
    const cents = inputDollarsToCents(amount);
    if (cents === null) {
      setFormError("Enter a valid amount.");
      return;
    }
    if (cents <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    if (minCents && cents < minCents) {
      setFormError(
        `Minimum withdrawal is ${formatMoneyFromCents(minCents, currency)}.`,
      );
      return;
    }
    if (cents > availableCents) {
      setFormError(
        `You only have ${formatMoneyFromCents(availableCents, currency)} available.`,
      );
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    const cents = inputDollarsToCents(amount);
    if (cents === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await axios.post("/api/organizer/payouts/requests", {
        amountCents: cents,
      });
      setConfirmOpen(false);
      setAmount("");
      setNote("");
      setSuccess("Withdrawal request submitted. We'll email you once it is reviewed.");
      void load();
      window.setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setFormError(msg || "Could not submit the withdrawal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    if (!confirm("Cancel this pending withdrawal request?")) return;
    setCancellingId(id);
    try {
      await axios.post(`/api/organizer/payouts/requests/${id}/cancel`);
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not cancel the request.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section
      aria-labelledby="organizer-withdraw-heading"
      className="space-y-5 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="organizer-withdraw-heading"
            className="font-display text-lg font-semibold text-foreground"
          >
            Request a withdrawal
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Move available earnings to your registered payout method. Requests
            are reviewed by All AXS before disbursement.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-auto"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
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

      {success ? (
        <div
          className="rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-panel)] border border-border bg-background/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Available
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatMoneyFromCents(availableCents, currency)}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-background/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Pending requests
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {formatMoneyFromCents(summary?.pendingCents ?? 0, currency)}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-background/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Minimum
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
            {minCents > 0 ? formatMoneyFromCents(minCents, currency) : "—"}
          </p>
        </div>
      </div>

      {summary?.payoutDestinationLabel ? (
        <p className="text-xs text-muted">
          Destination:{" "}
          <span className="font-medium text-foreground">
            {summary.payoutDestinationLabel}
          </span>
        </p>
      ) : null}

      {summary?.canRequestWithdrawal === false ? (
        <div
          className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {summary.blockedReason ||
            "Add payout details in Account → Payout profile before requesting a withdrawal."}
        </div>
      ) : pendingRequest ? (
        <div className="rounded-[var(--radius-panel)] border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          A withdrawal of{" "}
          <span className="font-semibold tabular-nums">
            {formatMoneyFromCents(pendingRequest.amountCents, pendingRequest.currency)}
          </span>{" "}
          is currently <span className="font-semibold">{payoutStatusLabel(pendingRequest.status)}</span>.
          You can submit another request once this one is paid or cancelled.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Textarea
            label="Note (optional)"
            rows={2}
            placeholder="e.g. needed by Friday for payroll"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="sm:col-span-2 -mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              You can request up to{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMoneyFromCents(availableCents, currency)}
              </span>{" "}
              right now.
            </p>
            <Button
              type="button"
              className="w-auto sm:w-auto"
              onClick={validateAndOpenConfirm}
              disabled={availableCents <= 0}
            >
              Request withdrawal
            </Button>
          </div>
          {formError ? (
            <p className="sm:col-span-2 text-sm text-primary" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      )}

      {requests.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {requests.map((row) => (
                <tr key={row.id} className="align-top text-foreground">
                  <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoneyFromCents(row.amountCents, row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${payoutStatusChipClass(
                        row.status,
                      )}`}
                    >
                      {payoutStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {row.rejectionReason ? (
                      <span className="text-red-300">{row.rejectionReason}</span>
                    ) : (
                      row.note || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "PENDING" ? (
                      <button
                        type="button"
                        onClick={() => void cancelRequest(row.id)}
                        disabled={cancellingId === row.id}
                        className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
                      >
                        {cancellingId === row.id ? "Cancelling…" : "Cancel"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <p className="text-sm text-muted">
            No withdrawal requests yet — your history will appear here once you submit one.
          </p>
        )
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        title="Confirm withdrawal"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You are about to request{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {amount
              ? formatMoneyFromCents(inputDollarsToCents(amount) ?? 0, currency)
              : ""}
          </span>{" "}
          from your available balance.
        </p>
        {note ? (
          <p className="mt-3 text-sm">
            <span className="text-muted">Note:</span>{" "}
            <span className="text-foreground">{note}</span>
          </p>
        ) : null}
        {formError ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {formError}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">
          We review withdrawal requests before disbursement. You can cancel a
          pending request from this page.
        </p>
      </Dialog>
    </section>
  );
}
