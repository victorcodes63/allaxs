"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  formatMoneyFromCents,
  formatShortDateTime,
} from "@/lib/organizer-sales";
import { normalizeCurrencyCode } from "@/lib/currency";
import { ResponsiveDataView } from "@/components/ui/ResponsiveDataView";

type RefundStatus =
  | "REQUESTED"
  | "APPROVED"
  | "DENIED"
  | "PROCESSING"
  | "REFUNDED"
  | "FAILED";

interface RefundRow {
  id: string;
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  eventTitle: string;
  amountCents: number;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
  updatedAt: string;
  decisionNote: string | null;
}

const STATUS_LABEL: Record<RefundStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  DENIED: "Denied",
  PROCESSING: "Processing",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

const STATUS_TONE: Record<RefundStatus, string> = {
  REQUESTED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  APPROVED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  PROCESSING: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  REFUNDED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  DENIED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  FAILED: "bg-red-500/10 text-red-300 border-red-500/30",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceStatus(v: unknown): RefundStatus {
  const allowed: RefundStatus[] = [
    "REQUESTED",
    "APPROVED",
    "DENIED",
    "PROCESSING",
    "REFUNDED",
    "FAILED",
  ];
  if (typeof v === "string" && (allowed as string[]).includes(v)) {
    return v as RefundStatus;
  }
  return "REQUESTED";
}

function normalizeRow(raw: unknown): RefundRow | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  return {
    id,
    orderId: typeof raw.orderId === "string" ? raw.orderId : "",
    buyerEmail: typeof raw.buyerEmail === "string" ? raw.buyerEmail : "",
    buyerName: typeof raw.buyerName === "string" ? raw.buyerName : "",
    eventTitle:
      typeof raw.eventTitle === "string" ? raw.eventTitle : "Event",
    amountCents:
      typeof raw.amountCents === "number" ? raw.amountCents : 0,
    currency: normalizeCurrencyCode(
      typeof raw.currency === "string" ? raw.currency : undefined,
    ),
    reason: typeof raw.reason === "string" ? raw.reason : null,
    status: coerceStatus(raw.status),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : typeof raw.createdAt === "string"
          ? raw.createdAt
          : "",
    decisionNote:
      typeof raw.decisionNote === "string" ? raw.decisionNote : null,
  };
}

export default function OrganizerRefundsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RefundStatus | "ALL">("REQUESTED");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionDialog, setDecisionDialog] = useState<
    | { mode: "deny"; row: RefundRow }
    | { mode: "approve"; row: RefundRow }
    | null
  >(null);
  const [decisionNote, setDecisionNote] = useState("");

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [initiateOrderId, setInitiateOrderId] = useState("");
  const [initiateAmount, setInitiateAmount] = useState("");
  const [initiateReason, setInitiateReason] = useState("");
  const [initiateBusy, setInitiateBusy] = useState(false);
  const [initiateError, setInitiateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      const res = await axios.get<unknown>(
        `/api/organizer/refunds${params.toString() ? `?${params.toString()}` : ""}`,
      );
      const list = Array.isArray(res.data)
        ? res.data
        : isRecord(res.data) && Array.isArray(res.data.refunds)
          ? res.data.refunds
          : [];
      setRows(
        list.map(normalizeRow).filter((r): r is RefundRow => r !== null),
      );
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load refund requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  const approve = async () => {
    if (!decisionDialog || decisionDialog.mode !== "approve") return;
    const row = decisionDialog.row;
    setBusyId(row.id);
    try {
      await axios.post(`/api/organizer/refunds/${row.id}/approve`, {
        note: decisionNote.trim() || undefined,
      });
      setDecisionDialog(null);
      setDecisionNote("");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not approve the refund.");
    } finally {
      setBusyId(null);
    }
  };

  const deny = async () => {
    if (!decisionDialog || decisionDialog.mode !== "deny") return;
    const row = decisionDialog.row;
    setBusyId(row.id);
    try {
      await axios.post(`/api/organizer/refunds/${row.id}/deny`, {
        note: decisionNote.trim() || undefined,
      });
      setDecisionDialog(null);
      setDecisionNote("");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not deny the refund.");
    } finally {
      setBusyId(null);
    }
  };

  const initiate = async () => {
    setInitiateError(null);
    if (!initiateOrderId.trim()) {
      setInitiateError("Order ID is required.");
      return;
    }
    setInitiateBusy(true);
    try {
      const cents =
        initiateAmount.trim() === ""
          ? null
          : Math.round(Number(initiateAmount) * 100);
      if (cents !== null && (!Number.isFinite(cents) || cents <= 0)) {
        setInitiateError("Amount must be a positive number or empty for full refund.");
        return;
      }
      await axios.post("/api/organizer/refunds", {
        orderId: initiateOrderId.trim(),
        amountCents: cents,
        reason: initiateReason.trim() || undefined,
      });
      setInitiateOpen(false);
      setInitiateOrderId("");
      setInitiateAmount("");
      setInitiateReason("");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setInitiateError(msg || "Could not initiate the refund.");
    } finally {
      setInitiateBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Organiser
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Refund requests
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Approve or deny refund requests for your events. Approving notifies
            All AXS to process the refund according to your refund policy.
          </p>
        </div>
        <Button
          type="button"
          className="w-auto"
          onClick={() => setInitiateOpen(true)}
        >
          Initiate refund
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2" aria-label="Filter refunds">
        {(
          ["REQUESTED", "APPROVED", "REFUNDED", "DENIED", "ALL"] as const
        ).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[border-color,background-color,color] ${
              filter === value
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface/70 text-muted hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {value === "ALL" ? "All" : STATUS_LABEL[value]}
          </button>
        ))}
        <div className="ml-auto">
          <Button
            type="button"
            variant="secondary"
            className="w-auto"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading refunds…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
          <p className="text-sm text-muted">No refund requests in this view.</p>
        </div>
      ) : (
        <ResponsiveDataView
          table={
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
              <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {filtered.map((row) => (
                <tr key={row.id} className="text-foreground align-top">
                  <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {row.createdAt ? formatShortDateTime(row.createdAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.eventTitle}</div>
                    {row.orderId ? (
                      <div className="font-mono text-xs text-muted">
                        {row.orderId.slice(0, 12)}…
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.buyerName || row.buyerEmail || "—"}</div>
                    {row.buyerName && row.buyerEmail ? (
                      <div className="text-xs text-muted">{row.buyerEmail}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMoneyFromCents(row.amountCents, row.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {row.reason || "—"}
                    {row.decisionNote ? (
                      <div className="mt-1 text-foreground/80">
                        Note: {row.decisionNote}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === "REQUESTED" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setDecisionDialog({ mode: "approve", row });
                            setDecisionNote("");
                          }}
                          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setDecisionDialog({ mode: "deny", row });
                            setDecisionNote("");
                          }}
                          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          }
          mobile={
            <ul className="grid gap-4">
              {filtered.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[var(--radius-panel)] border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold text-foreground line-clamp-2">
                      {row.eventTitle}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {row.buyerName || row.buyerEmail || "—"}
                  </p>
                  <p className="mt-2 text-sm font-medium tabular-nums">
                    {formatMoneyFromCents(row.amountCents, row.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted line-clamp-2">{row.reason || "—"}</p>
                  {row.decisionNote ? (
                    <p className="mt-1 text-xs text-foreground/80">Note: {row.decisionNote}</p>
                  ) : null}
                  {row.status === "REQUESTED" ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => {
                          setDecisionDialog({ mode: "approve", row });
                          setDecisionNote("");
                        }}
                        className="text-sm font-semibold text-primary disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => {
                          setDecisionDialog({ mode: "deny", row });
                          setDecisionNote("");
                        }}
                        className="text-sm font-semibold text-muted disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Dialog
        open={decisionDialog !== null}
        onClose={() => {
          if (busyId) return;
          setDecisionDialog(null);
        }}
        title={
          decisionDialog?.mode === "approve" ? "Approve refund?" : "Deny refund?"
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busyId !== null}
              onClick={() => setDecisionDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busyId !== null}
              onClick={() =>
                void (decisionDialog?.mode === "approve" ? approve() : deny())
              }
            >
              {busyId
                ? "Processing…"
                : decisionDialog?.mode === "approve"
                  ? "Approve"
                  : "Deny"}
            </Button>
          </div>
        }
      >
        {decisionDialog ? (
          <div className="space-y-3 text-sm text-muted">
            <p>
              {decisionDialog.mode === "approve"
                ? `Approve a refund of ${formatMoneyFromCents(
                    decisionDialog.row.amountCents,
                    decisionDialog.row.currency,
                  )} for ${decisionDialog.row.buyerEmail || "this buyer"}?`
                : `Deny ${decisionDialog.row.buyerEmail || "this buyer"}'s refund request?`}
            </p>
            <Textarea
              label="Note (optional)"
              rows={3}
              placeholder={
                decisionDialog.mode === "approve"
                  ? "Sent to the buyer with the approval email."
                  : "Reason that will be shared with the buyer."
              }
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={initiateOpen}
        onClose={() => {
          if (initiateBusy) return;
          setInitiateOpen(false);
        }}
        title="Initiate refund"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={initiateBusy}
              onClick={() => setInitiateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={initiateBusy} onClick={() => void initiate()}>
              {initiateBusy ? "Submitting…" : "Initiate"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            Trigger a refund directly from this organizer side without a buyer
            request. Leave the amount blank to refund the full order.
          </p>
          <Input
            label="Order ID"
            placeholder="Paste the order id"
            value={initiateOrderId}
            onChange={(e) => setInitiateOrderId(e.target.value)}
          />
          <Input
            label="Amount (optional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="Full order amount"
            value={initiateAmount}
            onChange={(e) => setInitiateAmount(e.target.value)}
          />
          <Textarea
            label="Reason"
            rows={3}
            placeholder="Reason shared with the buyer"
            value={initiateReason}
            onChange={(e) => setInitiateReason(e.target.value)}
          />
          {initiateError ? (
            <p className="text-sm text-primary" role="alert">
              {initiateError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
