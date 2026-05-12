"use client";

import { useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { formatMoneyFromCents } from "@/lib/organizer-sales";

export interface BulkRefundOrder {
  id: string;
  reference?: string | null;
  amountCents: number;
  currency: string;
  email: string;
}

export interface BulkRefundResult {
  succeeded: number;
  failed: number;
  failureReasons: string[];
}

interface BulkRefundDialogProps {
  /** Open the dialog with this list; `null` keeps it closed. */
  orders: ReadonlyArray<BulkRefundOrder> | null;
  /** Called when the user closes without acting. */
  onClose: () => void;
  /** Called after the bulk operation finishes (success or partial). */
  onCompleted: (result: BulkRefundResult) => void;
}

/**
 * Bulk-refund flow for the admin orders view. Always issues a FULL refund
 * per selected order (the per-row dialog covers partial refunds for the
 * single-order case). Sequential calls via `Promise.allSettled` so a
 * single failure doesn't abort the batch; the summary banner on
 * `/admin/orders` reports succeeded/failed counts.
 *
 * Why a hard cap? Refunds are money operations and the upstream payment
 * provider is NOT triggered automatically. Forcing admins to do
 * batches of <= 20 keeps the manual provider-side reconciliation
 * tractable and limits the blast radius of a misclick.
 */
export const BULK_REFUND_MAX = 20;

export function BulkRefundDialog({
  orders,
  onClose,
  onCompleted,
}: BulkRefundDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orders) {
      setReason("");
      setError(null);
    }
  }, [orders]);

  // Per-currency totals so the user can see exactly what's about to be
  // moved, even when (rare) multiple currencies are mixed in a batch.
  const totalsByCurrency = useMemo(() => {
    if (!orders) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const order of orders) {
      map.set(order.currency, (map.get(order.currency) ?? 0) + order.amountCents);
    }
    return map;
  }, [orders]);

  if (!orders) return null;

  const count = orders.length;
  const overCap = count > BULK_REFUND_MAX;

  const submit = async () => {
    if (overCap) {
      setError(
        `Maximum ${BULK_REFUND_MAX} orders per bulk refund. Currently selected: ${count}.`,
      );
      return;
    }
    if (count === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);

    const trimmedReason = reason.trim() || undefined;
    const results = await Promise.allSettled(
      orders.map((order) =>
        axios.post(`/api/admin/orders/${order.id}/refund`, {
          amountCents: order.amountCents,
          reason: trimmedReason,
        }),
      ),
    );

    let succeeded = 0;
    const failureReasons: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded += 1;
      } else {
        const reasonText = isAxiosError(result.reason)
          ? ((result.reason.response?.data as { message?: string } | undefined)
              ?.message ??
            result.reason.message ??
            "Unknown error")
          : "Unknown error";
        failureReasons.push(reasonText);
      }
    }
    const failed = results.length - succeeded;

    setSubmitting(false);
    onCompleted({ succeeded, failed, failureReasons });
  };

  return (
    <Dialog
      open={!!orders}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={count > 1 ? `Refund ${count} orders` : "Refund order"}
      ariaLabel="Bulk refund dialog"
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={submitting || overCap || count === 0}
            className="w-auto bg-red-600 text-white hover:bg-red-700"
          >
            {submitting
              ? "Refunding…"
              : count > 1
                ? `Refund ${count}`
                : "Refund"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {overCap ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            You selected {count} orders, but bulk refund is capped at{" "}
            {BULK_REFUND_MAX}. Refund this batch first, then continue with the
            rest.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-3 text-xs">
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Orders
            </dt>
            <dd className="mt-0.5 tabular-nums text-foreground/90">{count}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Refund total
            </dt>
            <dd className="mt-0.5 space-y-0.5 text-foreground/90 tabular-nums">
              {Array.from(totalsByCurrency.entries()).map(
                ([currency, cents]) => (
                  <div key={currency}>
                    {formatMoneyFromCents(cents, currency)}
                  </div>
                ),
              )}
            </dd>
          </div>
        </dl>

        <div className="max-h-48 overflow-y-auto rounded-[var(--radius-panel)] border border-border/70 bg-surface/60">
          <ul className="divide-y divide-border/40 text-xs">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="min-w-0 truncate text-foreground/85">
                  {order.reference || order.id.slice(0, 8)}
                  <span className="text-muted/70"> · {order.email}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground/90">
                  {formatMoneyFromCents(order.amountCents, order.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Event cancelled, refunding all affected attendees."
          rows={3}
          aria-label="Bulk refund reason"
        />

        <div className="rounded-[var(--radius-panel)] border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
          <strong className="font-semibold">Provider refunds are not
            automatic.</strong>{" "}
          Each order&apos;s payment-provider refund must still be
          issued from that provider's dashboard. This action only updates the
          order status to REFUNDED on All AXS and writes an admin audit log
          entry per order.
        </div>
      </div>
    </Dialog>
  );
}
