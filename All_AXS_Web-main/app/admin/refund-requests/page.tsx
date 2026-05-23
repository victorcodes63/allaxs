"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";
import {
  RefundRequestReviewDialog,
  type AdminRefundRequestRow,
} from "@/components/admin/RefundRequestReviewDialog";

interface RefundRequestsListPayload {
  total: number;
  limit: number;
  offset: number;
  refundRequests: AdminRefundRequestRow[];
}

export default function AdminRefundRequestsPage() {
  const [data, setData] = useState<RefundRequestsListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | "PENDING" | "APPROVED" | "DENIED">(
    "PENDING",
  );
  const [search, setSearch] = useState("");
  const [reviewTarget, setReviewTarget] = useState<AdminRefundRequestRow | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "deny" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "30", offset: "0" });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await axios.get<RefundRequestsListPayload>(
        `/api/admin/refund-requests?${params.toString()}`,
      );
      setData(res.data);
    } catch (e) {
      if (!isAxiosError(e)) setError("Could not load refund requests.");
      else {
        const msg = (e.response?.data as { message?: string })?.message;
        setError(msg || "Could not load refund requests.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function openReview(request: AdminRefundRequestRow, mode: "approve" | "deny") {
    setReviewTarget(request);
    setReviewMode(mode);
  }

  function closeReview() {
    setReviewTarget(null);
    setReviewMode(null);
  }

  return (
    <div className={ADMIN_PAGE_SHELL}>
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Support
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Refund requests
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Buyer-submitted refund requests awaiting review. Approving runs the refund
          you select — policy default is 75% unless you choose full or custom.
          Denying leaves the order paid.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select
            className="min-w-[10rem] rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | "PENDING" | "APPROVED" | "DENIED")
            }
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DENIED">Denied</option>
          </select>
        </label>
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted">
          Search
          <input
            type="search"
            className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
            placeholder="Email, order ref, or id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button type="button" variant="secondary" className="w-auto sm:mb-0" onClick={() => void load()}>
          Refresh
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data && data.refundRequests.length === 0 ? (
        <p className="text-sm text-muted">No refund requests match your filters.</p>
      ) : null}

      {data && data.refundRequests.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {data.refundRequests.map((row) => (
                <tr key={row.id} className="text-foreground align-top">
                  <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">{row.email}</td>
                  <td className="px-4 py-3 text-xs max-w-[12rem] truncate">
                    {row.event?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium tabular-nums whitespace-nowrap">
                    {row.order
                      ? formatMoneyFromCents(row.order.amountCents, row.order.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase whitespace-nowrap">
                    {row.status}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[16rem]">
                    <span className="line-clamp-3">{row.reason}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      {row.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-red-400 hover:underline"
                            onClick={() => openReview(row, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-left text-sm font-medium text-primary hover:underline"
                            onClick={() => openReview(row, "deny")}
                          >
                            Deny
                          </button>
                        </>
                      ) : null}
                      {row.order ? (
                        <Link
                          href={`/admin/orders?search=${encodeURIComponent(row.order.reference || row.order.id)}`}
                          className="text-sm font-medium text-muted hover:text-primary hover:underline"
                        >
                          View order
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <RefundRequestReviewDialog
        request={reviewTarget}
        mode={reviewMode}
        onClose={closeReview}
        onCompleted={() => {
          closeReview();
          void load();
        }}
      />
    </div>
  );
}
