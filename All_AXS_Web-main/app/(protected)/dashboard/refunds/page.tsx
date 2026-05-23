"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import type { RefundRequestStatus } from "@/components/orders/RefundRequestPanel";

type BuyerRefundRequestRow = {
  id: string;
  orderId: string;
  reason: string;
  status: RefundRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
  event?: {
    id: string;
    title: string;
    slug?: string | null;
  } | null;
};

type RefundRequestsPayload = {
  total: number;
  limit: number;
  offset: number;
  refundRequests: BuyerRefundRequestRow[];
};

function formatWhen(iso: string | null | undefined): string | null {
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

function statusLabel(status: RefundRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "DENIED":
      return "Denied";
    default:
      return status;
  }
}

function statusTone(status: RefundRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "border-amber-400/40 bg-amber-500/10 text-amber-100";
    case "APPROVED":
      return "border-green-500/35 bg-green-500/10 text-green-200";
    case "DENIED":
      return "border-red-500/35 bg-red-500/10 text-red-200";
    default:
      return "border-border bg-background/60 text-foreground/80";
  }
}

export default function FanRefundsPage() {
  const [rows, setRows] = useState<BuyerRefundRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiCheckout = isApiCheckoutEnabled();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await axios.get<RefundRequestsPayload>("/api/orders/refund-requests?limit=50");
      setRows(res.data.refundRequests ?? []);
    } catch (e) {
      if (!isAxiosError(e)) {
        setError("Could not load refund requests.");
      } else {
        const msg = (e.response?.data as { message?: string })?.message;
        setError(msg || "Could not load refund requests.");
      }
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!apiCheckout) {
    return (
      <div className="space-y-4 pb-12">
        <header className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Purchases</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My refunds
          </h1>
        </header>
        <p className="text-sm text-muted">
          Refund tracking is available when API checkout is enabled for this environment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Purchases</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          My refunds
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Track refund requests you submitted from your orders. Need to file a new request? Open the
          order and use Request a refund.
        </p>
      </header>

      {rows === null ? (
        <p className="text-sm text-muted">Loading refund requests…</p>
      ) : error ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface px-5 py-4 text-sm text-muted">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/60 px-8 py-16 text-center space-y-4">
          <p className="text-lg text-muted">No refund requests yet.</p>
          <p className="text-sm text-muted">
            Submit a request from any eligible order in My orders.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/orders"
              className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
            >
              My orders
            </Link>
            <Link
              href="/dashboard/support"
              className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
            >
              Support center
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-[var(--radius-panel)] border border-border bg-surface md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-background/40 text-xs uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((row) => {
                  const submitted = formatWhen(row.createdAt);
                  const reviewed = formatWhen(row.reviewedAt);
                  return (
                    <tr key={row.id} className="text-foreground/90">
                      <td className="px-4 py-4">
                        <p className="font-medium text-foreground">
                          {row.event?.title ?? "Your event"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{row.reason}</p>
                        {row.adminNote && row.status === "DENIED" ? (
                          <p className="mt-1 text-xs text-red-200/90">Note: {row.adminNote}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusTone(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                        {reviewed ? (
                          <p className="mt-1 text-xs text-muted">Reviewed {reviewed}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-muted">{submitted ?? "—"}</td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/orders/${row.orderId}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          View order →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-4 md:hidden">
            {rows.map((row) => {
              const submitted = formatWhen(row.createdAt);
              const reviewed = formatWhen(row.reviewedAt);
              return (
                <li
                  key={row.id}
                  className="rounded-[var(--radius-panel)] border border-border bg-surface p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-base font-semibold text-foreground line-clamp-2">
                      {row.event?.title ?? "Your event"}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{row.reason}</p>
                  {submitted ? (
                    <p className="mt-2 text-xs text-muted">Submitted {submitted}</p>
                  ) : null}
                  {reviewed ? (
                    <p className="text-xs text-muted">Reviewed {reviewed}</p>
                  ) : null}
                  {row.adminNote && row.status === "DENIED" ? (
                    <p className="mt-2 text-xs text-red-200/90">Note: {row.adminNote}</p>
                  ) : null}
                  <Link
                    href={`/dashboard/orders/${row.orderId}`}
                    className="mt-4 inline-block text-sm font-semibold text-primary"
                  >
                    View order →
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
