"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadOrderSnapshot, type StoredOrder } from "@/lib/checkout-storage";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<StoredOrder | null | undefined>(undefined);

  useEffect(() => {
    setOrder(loadOrderSnapshot(orderId));
  }, [orderId]);

  if (order === undefined) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-muted">
        Loading confirmation…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-6">
        <h1 className="font-display text-2xl text-foreground">Order not found</h1>
        <p className="text-muted">
          This confirmation link may have expired in your browser, or the order id is invalid.
        </p>
        <ArrowCtaLink href="/events" variant="primary">
          Browse events
        </ArrowCtaLink>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-16">
      <div className="rounded-[var(--radius-panel)] border border-border bg-surface p-8 md:p-10 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-wash text-3xl">
          ✓
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">You&apos;re in</p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">
          Thanks, {order.buyerName.split(" ")[0]}!
        </h1>
        <p className="text-muted leading-relaxed">
          Order <span className="font-mono text-foreground text-sm">{order.orderId.slice(0, 8)}…</span>{" "}
          is confirmed (demo—no real charge). Your passes are saved in this browser—open{" "}
          <Link href="/tickets" className="text-primary font-semibold hover:underline">
            My tickets
          </Link>{" "}
          to open each pass and scan the QR code.
        </p>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-border bg-background/80 p-6 md:p-8 space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">{order.eventTitle}</h2>
        <ul className="divide-y divide-border text-sm">
          {order.lineItems.map((li) => (
            <li key={li.ticketTypeId} className="flex justify-between gap-4 py-3">
              <span>
                {li.name} × {li.quantity}
              </span>
              <span className="tabular-nums font-medium">
                {(li.unitPriceCents * li.quantity) / 100} {li.currency}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-4 py-4 font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">
              {order.totalCents / 100} {order.currency}
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted">
          Confirmation sent to <span className="text-foreground">{order.buyerEmail}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <ArrowCtaLink href="/tickets" variant="primary" className="justify-center">
          View my tickets
        </ArrowCtaLink>
        <ArrowCtaLink
          href={`/e/${order.eventSlug}`}
          variant="outline"
          className="justify-center"
        >
          Back to event
        </ArrowCtaLink>
      </div>
    </div>
  );
}
