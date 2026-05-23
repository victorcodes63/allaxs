"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import {
  formatMoney,
  normalizeBuyerOrderDetail,
  orderStatusLabel,
  type BuyerOrderDetail,
} from "@/lib/orders-api";
import { InstallmentPaymentPanel } from "@/components/orders/InstallmentPaymentPanel";
import { OrderActionsPanel } from "@/components/orders/OrderActionsPanel";
import { RefundRequestPanel } from "@/components/orders/RefundRequestPanel";
import { TicketCalendarActions } from "@/components/tickets/TicketCalendarActions";
import { hubLegalHref } from "@/lib/legal/hub-paths";

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<BuyerOrderDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const apiCheckout = isApiCheckoutEnabled();

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get(`/api/checkout/orders/${orderId}`);
      const { order: normalized } = normalizeBuyerOrderDetail(res.data, orderId);
      setOrder(normalized);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        "Could not load this order.";
      setError(message);
      setOrder(null);
    }
  }, [orderId]);

  useEffect(() => {
    if (!apiCheckout) return;
    void load();
  }, [apiCheckout, load]);

  if (!apiCheckout) {
    return <p className="text-sm text-muted">Order details require API checkout.</p>;
  }

  if (order === undefined) {
    return <p className="text-sm text-muted">Loading order…</p>;
  }

  if (!order || error) {
    return (
      <div className="space-y-4 pb-12">
        <Link href="/dashboard/orders" className="text-sm text-muted hover:text-primary">
          ← My orders
        </Link>
        <p className="text-sm text-muted">{error ?? "Order not found."}</p>
      </div>
    );
  }

  const eventWhen = formatWhen(order.eventStartAt);
  const eventUrl = order.eventSlug
    ? `/dashboard/events/${order.eventSlug}`
    : null;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
        >
          ← My orders
        </Link>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
            {orderStatusLabel(order.status)}
          </span>
          <span className="text-xs text-muted">
            Placed {formatWhen(order.createdAt) ?? "—"}
          </span>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {order.eventTitle}
        </h1>
        {eventWhen ? <p className="text-sm text-muted">{eventWhen}</p> : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
              Order summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Total paid</dt>
                <dd className="font-semibold text-foreground">
                  {formatMoney(order.totalCents, order.currency)}
                </dd>
              </div>
              {order.discountCents > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Discount</dt>
                  <dd className="text-foreground">
                    −{formatMoney(order.discountCents, order.currency)}
                    {order.coupon ? ` (${order.coupon.code})` : ""}
                  </dd>
                </div>
              ) : null}
              {order.paymentReference ? (
                <div>
                  <dt className="text-muted">Payment reference</dt>
                  <dd className="mt-0.5 font-mono text-xs text-foreground break-all">
                    {order.paymentReference}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Buyer email</dt>
                <dd className="mt-0.5 text-foreground">{order.buyerEmail}</dd>
              </div>
            </dl>
            {order.lineItems.length > 0 ? (
              <ul className="mt-5 space-y-2 border-t border-border/70 pt-5 text-sm">
                {order.lineItems.map((item) => (
                  <li key={item.ticketTypeId} className="flex justify-between gap-4">
                    <span className="text-foreground">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="text-muted shrink-0">
                      {formatMoney(item.unitPriceCents * item.quantity, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {order.paymentPlan ? (
            <InstallmentPaymentPanel orderId={order.id} paymentPlan={order.paymentPlan} />
          ) : null}

          <OrderActionsPanel orderId={order.id} orderStatus={order.status} />

          <RefundRequestPanel
            orderId={order.id}
            orderStatus={order.status}
            enabled={apiCheckout}
            refundPolicyHref={hubLegalHref("/dashboard", "refund-policy")}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 sm:p-6 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
              Quick links
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/tickets"
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  Open my tickets
                </Link>
              </li>
              {eventUrl ? (
                <li>
                  <Link
                    href={eventUrl}
                    className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    View event page
                  </Link>
                </li>
              ) : null}
              <li>
                <Link
                  href={`/orders/${order.id}/confirmation`}
                  className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                >
                  Order confirmation
                </Link>
              </li>
            </ul>
          </div>

          {order.eventStartAt ? (
            <TicketCalendarActions
              title={order.eventTitle}
              startIso={order.eventStartAt}
              endIso={order.eventEndAt}
              description={`All AXS order ${order.id.slice(0, 8)}`}
              eventUrl={origin && eventUrl ? `${origin}${eventUrl}` : undefined}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
