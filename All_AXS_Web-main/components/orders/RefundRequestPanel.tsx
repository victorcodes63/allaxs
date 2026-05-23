"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { STANDARD_REFUND_PERCENT } from "@/lib/refunds/policy";

export type RefundRequestStatus = "PENDING" | "APPROVED" | "DENIED";

export interface BuyerRefundRequest {
  id: string;
  orderId: string;
  email: string;
  reason: string;
  status: RefundRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
}

interface RefundRequestPanelProps {
  orderId: string;
  orderStatus: string;
  enabled: boolean;
  refundPolicyHref?: string;
}

function statusMessage(request: BuyerRefundRequest): string {
  switch (request.status) {
    case "PENDING":
      return "Your refund request is pending admin review. We will email you when it is processed.";
    case "APPROVED":
      return "Your refund request was approved. The refund has been processed to your original payment method.";
    case "DENIED":
      return request.adminNote
        ? `Your refund request was denied. Note from our team: ${request.adminNote}`
        : "Your refund request was denied. Contact support if you have questions.";
    default:
      return "";
  }
}

export function RefundRequestPanel({
  orderId,
  orderStatus,
  enabled,
  refundPolicyHref = "/refund-policy",
}: RefundRequestPanelProps) {
  const [request, setRequest] = useState<BuyerRefundRequest | null | undefined>(
    undefined,
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || orderStatus !== "PAID") {
      setRequest(null);
      return;
    }
    try {
      const res = await axios.get<{ refundRequest: BuyerRefundRequest | null }>(
        `/api/orders/${orderId}/refund-request`,
      );
      setRequest(res.data.refundRequest);
    } catch {
      setRequest(null);
    }
  }, [enabled, orderId, orderStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled || orderStatus !== "PAID") {
    return null;
  }

  if (request === undefined) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 px-5 py-4 text-sm text-muted">
        Checking refund request status…
      </div>
    );
  }

  if (request) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Refund request</h2>
        <p className="text-sm text-muted leading-relaxed">{statusMessage(request)}</p>
        <dl className="grid gap-2 text-xs text-muted">
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em]">Submitted</dt>
            <dd className="mt-0.5 text-foreground">
              {new Date(request.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-[0.14em]">Your reason</dt>
            <dd className="mt-0.5 text-foreground whitespace-pre-wrap">{request.reason}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError("Please enter at least 10 characters explaining why you need a refund.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post<{ refundRequest: BuyerRefundRequest }>(
        `/api/orders/${orderId}/refund-request`,
        { reason: trimmed },
      );
      setRequest(res.data.refundRequest);
      setReason("");
    } catch (err) {
      const fallback = "Unable to submit refund request. Please try again.";
      if (isAxiosError(err)) {
        const apiMessage = (err.response?.data as { message?: string | string[] })?.message;
        setError(
          Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage ?? fallback,
        );
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Request a refund</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          Tell us why you need a refund. An admin will review your request — approval
          is not automatic. If approved, eligible refunds are typically processed at{" "}
          {STANDARD_REFUND_PERCENT}% of the ticket value per our{" "}
          <Link href={refundPolicyHref} className="underline hover:text-foreground">
            refund &amp; cancellation policy
          </Link>
          . Full refunds may apply for cancelled events or platform errors.
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <Textarea
        label="Reason for refund"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="e.g. I can no longer attend the event due to a schedule conflict."
        rows={4}
      />

      <Button
        type="button"
        variant="secondary"
        className="w-auto"
        disabled={submitting}
        onClick={() => void submit()}
      >
        {submitting ? "Submitting…" : "Submit refund request"}
      </Button>
    </div>
  );
}
