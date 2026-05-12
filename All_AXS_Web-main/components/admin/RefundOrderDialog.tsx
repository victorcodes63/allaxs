"use client";

import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface RefundOrderTarget {
  id: string;
  reference?: string | null;
  amountCents: number;
  currency: string;
  email: string;
  status: string;
}

interface RefundOrderDialogProps {
  order: RefundOrderTarget | null;
  onClose: () => void;
  onRefunded: () => void;
}

function formatMajor(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseMajorToCents(value: string): number | null {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

/**
 * Refund flow for the admin /admin/orders view. Defaults to a full refund
 * (whatever the order's `amountCents` is) but lets an admin enter a partial
 * amount. Posts to `POST /api/admin/orders/:id/refund` which is proxied to
 * the existing NestJS endpoint and writes an audit log entry.
 */
export function RefundOrderDialog({
  order,
  onClose,
  onRefunded,
}: RefundOrderDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setAmount(formatMajor(order.amountCents));
      setReason("");
      setError(null);
    }
  }, [order]);

  if (!order) return null;

  const totalLabel = `${order.currency} ${formatMajor(order.amountCents)}`;

  const submit = async () => {
    setError(null);

    const requestedCents = parseMajorToCents(amount);
    if (requestedCents === null) {
      setError("Enter a positive refund amount.");
      return;
    }
    if (requestedCents > order.amountCents) {
      setError(`Refund cannot exceed the order total of ${totalLabel}.`);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`/api/admin/orders/${order.id}/refund`, {
        amountCents: requestedCents,
        reason: reason.trim() || undefined,
      });
      onRefunded();
    } catch (err) {
      const fallback = "Failed to refund order. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (err.response?.data as { message?: string } | undefined)
          ?.message;
        if (status === 400) {
          setError(apiMessage ?? "Order cannot be refunded right now.");
        } else if (status === 403) {
          setError("You do not have permission to refund orders.");
        } else if (status === 404) {
          setError("Order not found.");
        } else {
          setError(apiMessage ?? err.message ?? fallback);
        }
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!order}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Refund order"
      ariaLabel="Refund order dialog"
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
            disabled={submitting}
            className="w-auto bg-red-600 text-white hover:bg-red-700"
          >
            {submitting ? "Refunding…" : "Refund order"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-3 text-xs">
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Reference
            </dt>
            <dd className="mt-0.5 truncate text-foreground/90">
              {order.reference || order.id.slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Buyer
            </dt>
            <dd className="mt-0.5 truncate text-foreground/90">{order.email}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Order total
            </dt>
            <dd className="mt-0.5 text-foreground/90">{totalLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Status
            </dt>
            <dd className="mt-0.5 text-foreground/90">
              {order.status.replace(/_/g, " ")}
            </dd>
          </div>
        </dl>

        <Input
          label={`Refund amount (${order.currency})`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={formatMajor(order.amountCents)}
          inputMode="decimal"
          autoFocus
        />

        <Textarea
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Buyer requested cancellation."
          rows={3}
        />

        <p className="text-xs leading-relaxed text-muted">
          Refunds change the order status to REFUNDED and are logged in the
          admin audit trail. Payment-provider refunds are not
          triggered automatically — handle those in the provider dashboard.
        </p>
      </div>
    </Dialog>
  );
}
