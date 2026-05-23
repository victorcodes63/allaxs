"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import {
  formatMoney,
  normalizeBuyerOrdersListPayload,
  orderStatusLabel,
  type BuyerOrderListItem,
} from "@/lib/orders-api";

const PAGE_SIZE = 20;

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
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

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<BuyerOrderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const apiCheckout = isApiCheckoutEnabled();

  const loadPage = useCallback(async (nextOffset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setError(null);
    try {
      const res = await fetch(
        `/api/checkout/orders?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { credentials: "same-origin" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data as { message?: string }).message || "Could not load orders.";
        if (!append) {
          setError(message);
          setOrders([]);
        }
        return;
      }
      const page = normalizeBuyerOrdersListPayload(data);
      setOrders((prev) => (append && prev ? [...prev, ...page.orders] : page.orders));
      setTotal(page.total);
      setOffset(page.offset + page.orders.length);
    } catch {
      if (!append) {
        setError("Could not load orders.");
        setOrders([]);
      }
    } finally {
      if (append) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!apiCheckout) return;
    setOrders(null);
    void loadPage(0, false);
  }, [apiCheckout, loadPage]);

  const hasMore = useMemo(() => {
    if (orders === null) return false;
    return orders.length < total;
  }, [orders, total]);

  if (!apiCheckout) {
    return (
      <div className="space-y-4 pb-12">
        <header className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Purchases</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My orders
          </h1>
        </header>
        <p className="text-sm text-muted">
          Order history is available when API checkout is enabled for this environment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Purchases</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          My orders
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Receipts, payment references, and refund requests for everything you have bought on All
          AXS.
        </p>
      </header>

      {orders === null ? (
        <p className="text-sm text-muted">Loading orders…</p>
      ) : error ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-5 py-4 text-sm text-muted">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
          <p className="text-lg text-muted">No orders yet.</p>
          <Link
            href="/dashboard/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-4">
            {orders.map((order) => {
              const when = formatWhen(order.eventStartAt);
              return (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="block rounded-[var(--radius-panel)] border border-border bg-surface p-5 transition-colors hover:border-primary/35 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-display text-lg font-semibold text-foreground line-clamp-2">
                          {order.eventTitle}
                        </p>
                        {when ? <p className="text-sm text-muted">{when}</p> : null}
                        <p className="text-xs text-muted">
                          {order.ticketCount} pass{order.ticketCount === 1 ? "" : "es"} · Ordered{" "}
                          {formatWhen(order.createdAt) ?? "—"}
                        </p>
                        {order.paymentReference ? (
                          <p className="text-xs text-muted font-mono truncate">
                            Ref {order.paymentReference}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <span className="rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                          {orderStatusLabel(order.status)}
                        </span>
                        <p className="text-base font-semibold text-foreground">
                          {formatMoney(order.totalCents, order.currency)}
                        </p>
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                          View order →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 hover:bg-primary/5 disabled:opacity-50"
                disabled={loadingMore}
                onClick={() => void loadPage(offset, true)}
              >
                {loadingMore ? "Loading more…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
