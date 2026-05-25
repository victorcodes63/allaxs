"use client";

import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  RefundAmountSelector,
  refundSelectionToPayload,
  type RefundAmountSelection,
} from "@/components/admin/RefundAmountSelector";
import { calculatePolicyRefundCents, resolveRefundPreview } from "@/lib/refunds/policy";

export interface AdminRefundRequestRow {
  id: string;
  orderId: string;
  email: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
  order?: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    reference?: string | null;
  } | null;
  event?: {
    id: string;
    title: string;
    slug?: string | null;
  } | null;
}

interface RefundRequestReviewDialogProps {
  request: AdminRefundRequestRow | null;
  mode: "approve" | "deny" | null;
  onClose: () => void;
  onCompleted: () => void;
}

export function RefundRequestReviewDialog({
  request,
  mode,
  onClose,
  onCompleted,
}: RefundRequestReviewDialogProps) {
  const [note, setNote] = useState("");
  const [refundSelection, setRefundSelection] = useState<RefundAmountSelection>({
    refundMode: "POLICY",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request && mode) {
      setNote("");
      setRefundSelection({ refundMode: "POLICY" });
      setError(null);
    }
  }, [request, mode]);

  if (!request || !mode) return null;

  const isApprove = mode === "approve";
  const order = request.order;
  const totalLabel = order
    ? formatMoneyFromCents(order.amountCents, order.currency)
    : "—";
  const policyLabel =
    order != null
      ? formatMoneyFromCents(
          calculatePolicyRefundCents(order.amountCents),
          order.currency,
        )
      : "—";

  const submit = async () => {
    if (isApprove && order) {
      const preview = resolveRefundPreview(
        order.amountCents,
        refundSelection.refundMode,
        refundSelection.customAmountCents,
      );
      if (
        refundSelection.refundMode === "CUSTOM" &&
        (!refundSelection.customAmountCents ||
          refundSelection.customAmountCents <= 0 ||
          refundSelection.customAmountCents > order.amountCents)
      ) {
        setError("Enter a valid custom refund amount.");
        return;
      }
      if (preview.refundAmountCents <= 0) {
        setError("Refund amount must be greater than zero.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await axios.patch(
        `/api/admin/refund-requests/${request.id}/${mode}`,
        {
          note: note.trim() || undefined,
          ...(isApprove ? refundSelectionToPayload(refundSelection) : {}),
        },
      );
      onCompleted();
    } catch (err) {
      const fallback = isApprove
        ? "Failed to approve refund request."
        : "Failed to deny refund request.";
      if (isAxiosError(err)) {
        const apiMessage = (err.response?.data as { message?: string })?.message;
        setError(apiMessage ?? err.message ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!request}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={isApprove ? "Approve refund request" : "Deny refund request"}
      ariaLabel={isApprove ? "Approve refund request dialog" : "Deny refund request dialog"}
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
            onClick={() => void submit()}
            disabled={submitting}
            className={
              isApprove
                ? "w-auto bg-red-600 text-white hover:bg-red-700"
                : "w-auto"
            }
          >
            {submitting
              ? isApprove
                ? "Approving…"
                : "Denying…"
              : isApprove
                ? "Approve & refund"
                : "Deny request"}
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

        <dl className="grid grid-cols-1 gap-2 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">Buyer</dt>
            <dd className="mt-0.5 truncate text-foreground/90">{request.email}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">Event</dt>
            <dd className="mt-0.5 truncate text-foreground/90">
              {request.event?.title ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">Order total</dt>
            <dd className="mt-0.5 text-foreground/90">{totalLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
              Policy default (75%)
            </dt>
            <dd className="mt-0.5 text-foreground/90">{policyLabel}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold uppercase tracking-[0.14em] text-muted">Reference</dt>
            <dd className="mt-0.5 truncate text-foreground/90">
              {order?.reference || order?.id.slice(0, 8) || "—"}
            </dd>
          </div>
        </dl>

        <div className="rounded-[var(--radius-panel)] border border-border/70 bg-background/40 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Buyer reason
          </p>
          <p className="mt-2 whitespace-pre-wrap text-foreground/90">{request.reason}</p>
        </div>

        {isApprove && order ? (
          <RefundAmountSelector
            orderAmountCents={order.amountCents}
            currency={order.currency}
            value={refundSelection}
            onChange={setRefundSelection}
          />
        ) : null}

        <Textarea
          label="Admin note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            isApprove
              ? "e.g. Approved — event date changed."
              : "e.g. Denied — tickets already scanned at door."
          }
          rows={3}
        />

        <p className="text-xs leading-relaxed text-muted">
          {isApprove ? (
            <>
              Approving voids tickets, restores inventory, and marks the order REFUNDED.
              Default policy refund is 75% ({policyLabel}) unless you choose full or custom.
            </>
          ) : (
            <>Denying leaves the order PAID. The buyer can see your note if you add one.</>
          )}
        </p>
      </div>
    </Dialog>
  );
}
