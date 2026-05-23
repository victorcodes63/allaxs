"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type ResendState = "idle" | "sending" | "sent" | "failed";

type OrderActionsPanelProps = {
  orderId: string;
  orderStatus: string;
  canResendEmails?: boolean;
};

export function OrderActionsPanel({
  orderId,
  orderStatus,
  canResendEmails = true,
}: OrderActionsPanelProps) {
  const [ticketState, setTicketState] = useState<ResendState>("idle");
  const [receiptState, setReceiptState] = useState<ResendState>("idle");

  const paidLike = orderStatus === "PAID" || orderStatus === "REFUNDED";
  if (!canResendEmails || !paidLike) return null;

  const resendTickets = async () => {
    setTicketState("sending");
    try {
      const res = await fetch(`/api/checkout/orders/${orderId}/resend-tickets`, {
        method: "POST",
        credentials: "same-origin",
      });
      setTicketState(res.ok ? "sent" : "failed");
    } catch {
      setTicketState("failed");
    }
  };

  const resendReceipt = async () => {
    setReceiptState("sending");
    try {
      const res = await fetch(`/api/checkout/orders/${orderId}/resend-receipt`, {
        method: "POST",
        credentials: "same-origin",
      });
      setReceiptState(res.ok ? "sent" : "failed");
    } catch {
      setReceiptState("failed");
    }
  };

  const ticketLabel =
    ticketState === "sending"
      ? "Sending…"
      : ticketState === "sent"
        ? "Tickets sent"
        : ticketState === "failed"
          ? "Retry tickets email"
          : "Resend ticket email";

  const receiptLabel =
    receiptState === "sending"
      ? "Sending…"
      : receiptState === "sent"
        ? "Receipt sent"
        : receiptState === "failed"
          ? "Retry receipt email"
          : "Resend payment receipt";

  return (
    <section
      aria-labelledby="order-actions-heading"
      className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6"
    >
      <h2
        id="order-actions-heading"
        className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
      >
        Email delivery
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Resend your payment receipt or ticket PDF to the email on this order.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto min-w-[10rem]"
          disabled={ticketState === "sending"}
          onClick={() => void resendTickets()}
        >
          {ticketLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto min-w-[10rem]"
          disabled={receiptState === "sending"}
          onClick={() => void resendReceipt()}
        >
          {receiptLabel}
        </Button>
      </div>
    </section>
  );
}
