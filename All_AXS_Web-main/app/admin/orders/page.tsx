"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  RefundOrderDialog,
  type RefundOrderTarget,
} from "@/components/admin/RefundOrderDialog";
import {
  BULK_REFUND_MAX,
  BulkRefundDialog,
  type BulkRefundOrder,
  type BulkRefundResult,
} from "@/components/admin/BulkRefundDialog";
import { useSelection } from "@/lib/hooks/use-selection";

type OrderStatusKey =
  | "DRAFT"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED";

interface AdminOrderRow {
  id: string;
  reference: string | null;
  status: OrderStatusKey;
  amountCents: number;
  feesCents: number;
  currency: string;
  email: string;
  phone: string | null;
  itemCount: number;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string | null;
    organizer: { id: string; orgName: string } | null;
  } | null;
}

interface AdminOrdersResponse {
  items: AdminOrderRow[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_PADDING =
  "mx-auto w-full max-w-[min(100%,1400px)] px-4 sm:px-6 lg:px-8";

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "PAID", label: "Paid" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "DRAFT", label: "Draft" },
];

const PAGE_SIZE = 25;

function statusChipClass(status: string): string {
  switch (status) {
    case "PAID":
      return "border border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case "REFUNDED":
      return "border border-amber-400/25 bg-amber-500/15 text-amber-100";
    case "PENDING":
    case "PARTIALLY_PAID":
      return "border border-sky-400/25 bg-sky-500/15 text-sky-100";
    case "FAILED":
    case "CANCELLED":
      return "border border-red-400/30 bg-red-500/12 text-red-100";
    case "DRAFT":
      return "border border-white/10 bg-white/[0.04] text-muted";
    default:
      return "border border-white/10 bg-white/[0.06] text-foreground/80";
  }
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

function AdminOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus =
    STATUS_FILTERS.find((f) => f.value === searchParams.get("status"))?.value ??
    "all";
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";
  const initialEventId = searchParams.get("eventId") ?? "";
  const initialOrganizerId = searchParams.get("organizerId") ?? "";
  const initialOffset = Math.max(
    Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );

  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [fromDate, setFromDate] = useState<string>(initialFrom);
  const [toDate, setToDate] = useState<string>(initialTo);
  const [eventId, setEventId] = useState<string>(initialEventId);
  const [organizerId, setOrganizerId] = useState<string>(initialOrganizerId);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [refundTarget, setRefundTarget] = useState<RefundOrderTarget | null>(
    null,
  );
  // null = closed; non-empty array = open with payload
  const [bulkRefundTargets, setBulkRefundTargets] = useState<
    BulkRefundOrder[] | null
  >(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Reset to page 1 whenever filters change (but not on page change itself).
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, debouncedSearch, fromDate, toDate, eventId, organizerId]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    if (eventId) sp.set("eventId", eventId);
    if (organizerId) sp.set("organizerId", organizerId);
    sp.set("limit", String(PAGE_SIZE));
    sp.set("offset", String(offset));
    return sp.toString();
  }, [
    statusFilter,
    debouncedSearch,
    fromDate,
    toDate,
    eventId,
    organizerId,
    offset,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AdminOrdersResponse>(
        `/api/admin/orders?${queryString}`,
      );
      setData(response.data);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load orders.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    if (eventId) sp.set("eventId", eventId);
    if (organizerId) sp.set("organizerId", organizerId);
    if (offset > 0) sp.set("offset", String(offset));
    const qs = sp.toString();
    router.replace(qs ? `/admin/orders?${qs}` : "/admin/orders", {
      scroll: false,
    });
  }, [
    router,
    statusFilter,
    debouncedSearch,
    fromDate,
    toDate,
    eventId,
    organizerId,
    offset,
  ]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + items.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const paidCount = items.filter((o) => o.status === "PAID").length;
  const refundedCount = items.filter((o) => o.status === "REFUNDED").length;

  // Only PAID / PARTIALLY_PAID orders are eligible for refund. Non-eligible
  // rows simply won't render a checkbox, but we filter at the source so
  // `useSelection`'s auto-prune treats them as removed if they switch
  // status mid-session (e.g. after another admin refunds one).
  const refundableItems = useMemo(
    () =>
      items.filter(
        (o) => o.status === "PAID" || o.status === "PARTIALLY_PAID",
      ),
    [items],
  );
  const getOrderId = useCallback((o: AdminOrderRow) => o.id, []);
  const selection = useSelection(refundableItems, getOrderId);
  const { clear: clearSelection, set: setSelected } = selection;
  const atCap = selection.size >= BULK_REFUND_MAX;

  // Capped select-all: only adds rows up to the bulk cap. Anything over
  // the cap stays out of the selection; the user has to refund the
  // first batch before they can keep going.
  const toggleSelectAllCapped = useCallback(() => {
    if (selection.size > 0) {
      clearSelection();
      return;
    }
    refundableItems
      .slice(0, BULK_REFUND_MAX)
      .forEach((o) => setSelected(o.id, true));
  }, [clearSelection, refundableItems, selection.size, setSelected]);

  // Switching filters/pages clears stale selection so admins don't
  // accidentally bulk-refund rows they can no longer see.
  useEffect(() => {
    clearSelection();
  }, [
    statusFilter,
    debouncedSearch,
    fromDate,
    toDate,
    eventId,
    organizerId,
    offset,
    clearSelection,
  ]);

  const onRefunded = () => {
    setRefundTarget(null);
    void load();
  };

  const openBulkRefund = () => {
    if (selection.size === 0) return;
    const selectedSet = new Set(selection.ids);
    const targets: BulkRefundOrder[] = refundableItems
      .filter((o) => selectedSet.has(o.id))
      .map((o) => ({
        id: o.id,
        reference: o.reference,
        amountCents: o.amountCents,
        currency: o.currency,
        email: o.email,
      }));
    setBulkRefundTargets(targets);
  };

  const closeBulkRefund = () => {
    setBulkRefundTargets(null);
  };

  const onBulkRefundCompleted = (result: BulkRefundResult) => {
    setBulkRefundTargets(null);
    clearSelection();

    const { succeeded, failed } = result;
    let message = `Refunded ${succeeded} order${succeeded === 1 ? "" : "s"}.`;
    if (failed > 0) {
      message += ` ${failed} failed (already refunded, no longer eligible, or a network error).`;
    }
    setActionMessage(message);
    setTimeout(() => setActionMessage(null), 8000);
    void load();
  };

  return (
    <main className={`${PAGE_PADDING} space-y-6 py-6 md:py-8`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Admin
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Orders
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every order on the platform across events, organisers, and statuses.
            Issue refunds with full audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
          <span className="rounded-full border border-border/70 bg-surface/80 px-3 py-1">
            {total} total
          </span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
            {paidCount} paid on page
          </span>
          {refundedCount > 0 ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
              {refundedCount} refunded on page
            </span>
          ) : null}
        </div>
      </header>

      {(eventId || organizerId) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 p-3 text-xs text-muted">
          <span className="font-semibold uppercase tracking-[0.14em]">
            Scoped to:
          </span>
          {eventId ? (
            <button
              type="button"
              onClick={() => setEventId("")}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-foreground hover:border-primary/60 hover:bg-primary/25"
              aria-label="Clear event filter"
            >
              event {eventId.slice(0, 8)}
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {organizerId ? (
            <button
              type="button"
              onClick={() => setOrganizerId("")}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-foreground hover:border-primary/60 hover:bg-primary/25"
              aria-label="Clear organiser filter"
            >
              organiser {organizerId.slice(0, 8)}
              <span aria-hidden>×</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-[2]">
            <label
              htmlFor="admin-orders-search"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              Search
            </label>
            <input
              id="admin-orders-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Reference or buyer email…"
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
              aria-label="Search orders"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:flex-none">
            {STATUS_FILTERS.map((filter) => {
              const active = filter.value === statusFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-[border-color,background-color,color] ${
                    active
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border bg-surface/80 text-muted hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label
              htmlFor="admin-orders-from"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              From
            </label>
            <input
              id="admin-orders-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <div>
            <label
              htmlFor="admin-orders-to"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              To
            </label>
            <input
              id="admin-orders-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
        </div>
      </div>

      {actionMessage ? (
        <div
          className="rounded-[var(--radius-panel)] border border-sky-400/30 bg-sky-500/10 p-3 text-sm text-sky-100"
          role="status"
        >
          {actionMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {refundableItems.length > 0 ? (
        <BulkRefundActionBar
          selectedCount={selection.size}
          refundableCount={refundableItems.length}
          atCap={atCap}
          onToggleSelectAll={toggleSelectAllCapped}
          onClear={clearSelection}
          onRefundSelected={openBulkRefund}
        />
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          Loading orders…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          {debouncedSearch.trim() || statusFilter !== "all" || fromDate || toDate || eventId || organizerId
            ? "No orders match the current filters."
            : "No orders on the platform yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((order) => {
            const refundable =
              order.status === "PAID" || order.status === "PARTIALLY_PAID";
            const isSelected = selection.isSelected(order.id);
            return (
              <AdminOrderCard
                key={order.id}
                order={order}
                refundable={refundable}
                isSelected={isSelected}
                disableSelection={refundable && atCap && !isSelected}
                onToggleSelected={() => selection.toggle(order.id)}
                onRefund={(target) => setRefundTarget(target)}
              />
            );
          })}
        </ul>
      )}

      {total > 0 ? (
        <nav
          aria-label="Orders pagination"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-4 py-3 text-xs text-muted"
        >
          <p className="tabular-nums">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev}
              className="inline-flex h-8 items-center rounded-full border border-border bg-surface/80 px-3 font-semibold transition-[border-color,color,background-color] enabled:hover:border-primary/40 enabled:hover:text-foreground disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasNext}
              className="inline-flex h-8 items-center rounded-full border border-border bg-surface/80 px-3 font-semibold transition-[border-color,color,background-color] enabled:hover:border-primary/40 enabled:hover:text-foreground disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </nav>
      ) : null}

      <RefundOrderDialog
        order={refundTarget}
        onClose={() => setRefundTarget(null)}
        onRefunded={onRefunded}
      />

      <BulkRefundDialog
        orders={bulkRefundTargets}
        onClose={closeBulkRefund}
        onCompleted={onBulkRefundCompleted}
      />
    </main>
  );
}

function BulkRefundActionBar({
  selectedCount,
  refundableCount,
  atCap,
  onToggleSelectAll,
  onClear,
  onRefundSelected,
}: {
  selectedCount: number;
  refundableCount: number;
  atCap: boolean;
  onToggleSelectAll: () => void;
  onClear: () => void;
  onRefundSelected: () => void;
}) {
  const anySelected = selectedCount > 0;
  const selectAllLabel = anySelected
    ? "Clear selection"
    : `Select all (${Math.min(refundableCount, BULK_REFUND_MAX)})`;

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border bg-surface/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <input
          type="checkbox"
          aria-label={selectAllLabel}
          checked={anySelected}
          ref={(el) => {
            if (el) {
              el.indeterminate = anySelected && selectedCount < refundableCount;
            }
          }}
          onChange={onToggleSelectAll}
          className="h-4 w-4 cursor-pointer rounded border-border bg-surface text-primary focus:ring-primary/30"
        />
        {anySelected ? (
          <span>
            {selectedCount} selected
            {atCap ? (
              <span className="ml-2 normal-case tracking-normal text-amber-100">
                · cap of {BULK_REFUND_MAX} reached
              </span>
            ) : null}
          </span>
        ) : (
          <span>{selectAllLabel}</span>
        )}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {anySelected ? (
          <button
            type="button"
            onClick={onClear}
            className={ROW_ACTION_GHOST}
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefundSelected}
          disabled={!anySelected}
          className={`${ROW_ACTION_DANGER} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Refund selected
        </button>
      </div>
    </div>
  );
}

const ROW_ACTION_BASE =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} border border-red-400/40 bg-red-500/10 text-red-100 hover:border-red-400/60 hover:bg-red-500/20 hover:text-white`;
const ROW_ACTION_GHOST = `${ROW_ACTION_BASE} border border-transparent text-muted hover:border-border hover:bg-wash/40 hover:text-foreground`;

function AdminOrderCard({
  order,
  refundable,
  isSelected,
  disableSelection,
  onToggleSelected,
  onRefund,
}: {
  order: AdminOrderRow;
  refundable: boolean;
  isSelected: boolean;
  disableSelection: boolean;
  onToggleSelected: () => void;
  onRefund: (target: RefundOrderTarget) => void;
}) {
  const eventLabel = order.event?.title ?? "Event not found";
  const organizerLabel = order.event?.organizer?.orgName ?? "Unknown organiser";
  const grossLabel = formatMoneyFromCents(order.amountCents, order.currency);
  const refLabel = order.reference || order.id.slice(0, 8);

  return (
    <li
      className={`flex flex-col gap-3 rounded-[var(--radius-panel)] border bg-surface/85 p-4 transition-[border-color,box-shadow] sm:flex-row sm:items-start sm:p-5 ${
        isSelected
          ? "border-primary/55 ring-1 ring-primary/35"
          : "border-border hover:border-primary/30"
      }`}
    >
      {refundable ? (
        <div className="flex shrink-0 items-start pt-1 sm:pt-2">
          <input
            type="checkbox"
            aria-label={`Select order ${refLabel} for bulk refund`}
            checked={isSelected}
            disabled={disableSelection}
            title={
              disableSelection
                ? `Bulk refund is capped at ${BULK_REFUND_MAX} orders per batch`
                : undefined
            }
            onChange={onToggleSelected}
            className="h-5 w-5 cursor-pointer rounded border-border bg-surface text-primary focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {refLabel}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(order.status)}`}
          >
            {statusLabel(order.status)}
          </span>
          <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 tabular-nums">
            {grossLabel}
          </span>
        </div>
        <p className="text-xs text-muted">
          {order.event ? (
            <Link
              href={`/admin/events/${order.event.id}`}
              className="font-medium text-foreground/85 underline-offset-2 hover:underline"
            >
              {eventLabel}
            </Link>
          ) : (
            <span className="font-medium text-foreground/85">{eventLabel}</span>
          )}
          <span className="text-muted/70"> · {organizerLabel}</span>
        </p>
        <div className="grid grid-cols-1 gap-1 text-xs text-muted tabular-nums sm:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground/85">Buyer</span>{" "}
            {order.email}
            {order.phone ? <span className="text-muted/70"> · {order.phone}</span> : null}
          </p>
          <p>
            <span className="font-semibold text-foreground/85">Items</span>{" "}
            {order.itemCount}
          </p>
          <p>
            <span className="font-semibold text-foreground/85">Fees</span>{" "}
            {formatMoneyFromCents(order.feesCents, order.currency)}
          </p>
          <p>
            <span className="font-semibold text-foreground/85">Placed</span>{" "}
            {formatDate(order.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-1.5 sm:items-end sm:justify-end sm:self-center">
        {refundable ? (
          <button
            type="button"
            onClick={() =>
              onRefund({
                id: order.id,
                reference: order.reference,
                amountCents: order.amountCents,
                currency: order.currency,
                email: order.email,
                status: order.status,
              })
            }
            className={ROW_ACTION_DANGER}
          >
            Refund
          </button>
        ) : null}
        {order.event ? (
          <Link
            href={`/admin/events/${order.event.id}`}
            className={ROW_ACTION_GHOST}
            aria-label={`Inspect ${eventLabel}`}
          >
            Inspect event
          </Link>
        ) : null}
        {order.event?.slug ? (
          <Link
            href={`/events/${order.event.slug}`}
            target="_blank"
            rel="noopener"
            className={ROW_ACTION_GHOST}
          >
            View live
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className={`${PAGE_PADDING} py-10`}>
          <p className="text-sm text-muted">Loading orders…</p>
        </main>
      }
    >
      <AdminOrdersPageContent />
    </Suspense>
  );
}
