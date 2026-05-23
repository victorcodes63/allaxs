"use client";

import { useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import {
  formatMoney,
  installmentStatusLabel,
  paymentPlanStatusLabel,
  type BuyerPaymentPlan,
  type PaymentInstallmentStatus,
} from "@/lib/orders-api";

type InstallmentPaymentPanelProps = {
  orderId: string;
  paymentPlan: BuyerPaymentPlan;
};

function formatDue(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusTone(status: PaymentInstallmentStatus): string {
  switch (status) {
    case "PAID":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "OVERDUE":
      return "border-red-400/35 bg-red-500/10 text-red-100";
    case "PENDING":
      return "border-primary/35 bg-primary/10 text-primary";
    default:
      return "border-border bg-background/40 text-muted";
  }
}

export function InstallmentPaymentPanel({ orderId, paymentPlan }: InstallmentPaymentPanelProps) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPending = useMemo(
    () =>
      [...paymentPlan.installments]
        .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
        .sort((a, b) => a.sequence - b.sequence)[0] ?? null,
    [paymentPlan.installments],
  );

  const canPay =
    paymentPlan.status === "ACTIVE" && nextPending !== null;

  const payNow = async () => {
    if (!canPay) return;
    setPaying(true);
    setError(null);
    try {
      const res = await axios.post<{
        authorizationUrl?: string;
        reference?: string;
        amountCents?: number;
        installmentSequence?: number;
      }>(`/api/checkout/orders/${encodeURIComponent(orderId)}/installments/pay`);
      const url = res.data.authorizationUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      setError("Payment could not be started. Please try again.");
    } catch (err) {
      const fallback = "Unable to start payment. Please try again.";
      if (isAxiosError(err)) {
        const apiMessage = (err.response?.data as { message?: string | string[] })?.message;
        setError(
          Array.isArray(apiMessage) ? apiMessage.join(", ") : apiMessage ?? fallback,
        );
      } else {
        setError(fallback);
      }
      setPaying(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
            Payment plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Total plan:{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(paymentPlan.totalAmount, paymentPlan.currency)}
            </span>
          </p>
        </div>
        <span className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
          {paymentPlanStatusLabel(paymentPlan.status)}
        </span>
      </div>

      <ul className="space-y-2">
        {paymentPlan.installments.map((inst) => {
          const isNext = nextPending?.sequence === inst.sequence;
          return (
            <li
              key={inst.sequence}
              className={[
                "flex flex-col gap-2 rounded-[var(--radius-card)] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                isNext ? "border-primary/40 bg-primary/5" : "border-border/75 bg-background/35",
              ].join(" ")}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Installment {inst.sequence}
                  <span className="ml-2 text-muted font-normal">
                    ({inst.pct}%)
                  </span>
                </p>
                <p className="text-xs text-muted">
                  Due {formatDue(inst.dueAt)}
                  {inst.paidAt ? ` · Paid ${formatDue(inst.paidAt)}` : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(inst.amount, paymentPlan.currency)}
                </span>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                    statusTone(inst.status),
                  ].join(" ")}
                >
                  {installmentStatusLabel(inst.status)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p className="text-sm text-primary">{error}</p>
      ) : null}

      {canPay && nextPending ? (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Next due:{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(nextPending.amount, paymentPlan.currency)}
            </span>{" "}
            by {formatDue(nextPending.dueAt)}
          </p>
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto"
            disabled={paying}
            onClick={() => void payNow()}
          >
            {paying ? "Redirecting to Paystack…" : "Pay now"}
          </Button>
        </div>
      ) : paymentPlan.status === "COMPLETED" ? (
        <p className="text-sm text-muted border-t border-border/70 pt-4">
          All installments are paid. Your tickets are fully active.
        </p>
      ) : null}
    </section>
  );
}
