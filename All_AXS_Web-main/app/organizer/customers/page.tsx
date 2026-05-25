"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import {
  formatMoneyFromCents,
  formatShortDateTime,
} from "@/lib/organizer-sales";
import { normalizeCurrencyCode } from "@/lib/currency";
import { ResponsiveDataView } from "@/components/ui/ResponsiveDataView";

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  ordersCount: number;
  ticketsCount: number;
  totalSpentCents: number;
  currency: string;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

interface CustomerOrder {
  id: string;
  createdAt: string;
  eventTitle: string;
  status: string;
  amountCents: number;
  currency: string;
  ticketsInOrder: number;
}

interface CustomerDetail {
  customer: CustomerRow;
  orders: CustomerOrder[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeCustomerRow(raw: unknown): CustomerRow | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  return {
    id,
    email: typeof raw.email === "string" ? raw.email : "",
    name: typeof raw.name === "string" ? raw.name : "",
    ordersCount: typeof raw.ordersCount === "number" ? raw.ordersCount : 0,
    ticketsCount: typeof raw.ticketsCount === "number" ? raw.ticketsCount : 0,
    totalSpentCents:
      typeof raw.totalSpentCents === "number" ? raw.totalSpentCents : 0,
    currency: normalizeCurrencyCode(
      typeof raw.currency === "string" ? raw.currency : undefined,
    ),
    firstOrderAt: typeof raw.firstOrderAt === "string" ? raw.firstOrderAt : null,
    lastOrderAt: typeof raw.lastOrderAt === "string" ? raw.lastOrderAt : null,
  };
}

export default function OrganizerCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<unknown>("/api/organizer/customers");
      const list = Array.isArray(res.data)
        ? res.data
        : isRecord(res.data) && Array.isArray(res.data.customers)
          ? res.data.customers
          : [];
      const rows = list
        .map(normalizeCustomerRow)
        .filter((r): r is CustomerRow => r !== null);
      setCustomers(rows);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (customerId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await axios.get<unknown>(
        `/api/organizer/customers/${customerId}`,
      );
      if (!isRecord(res.data)) {
        setDetailError("Unexpected response.");
        return;
      }
      const customer = normalizeCustomerRow(res.data.customer ?? res.data);
      if (!customer) {
        setDetailError("Customer not found.");
        return;
      }
      const orders: CustomerOrder[] = Array.isArray(res.data.orders)
        ? res.data.orders
            .map((row) => {
              if (!isRecord(row)) return null;
              const id = typeof row.id === "string" ? row.id : null;
              if (!id) return null;
              return {
                id,
                createdAt:
                  typeof row.createdAt === "string" ? row.createdAt : "",
                eventTitle:
                  typeof row.eventTitle === "string" ? row.eventTitle : "Event",
                status: typeof row.status === "string" ? row.status : "",
                amountCents:
                  typeof row.amountCents === "number" ? row.amountCents : 0,
                currency: normalizeCurrencyCode(
                  typeof row.currency === "string" ? row.currency : undefined,
                ),
                ticketsInOrder:
                  typeof row.ticketsInOrder === "number"
                    ? row.ticketsInOrder
                    : 0,
              } satisfies CustomerOrder;
            })
            .filter((row): row is CustomerOrder => row !== null)
        : [];
      setDetail({ customer, orders });
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setDetailError(msg || "Could not load customer history.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (openCustomerId) {
      void loadDetail(openCustomerId);
    }
  }, [openCustomerId, loadDetail]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Customers
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Distinct buyers across your published events. Click a row to see their
          order history with you. Sales totals follow paid orders only.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Input
            label="Search"
            placeholder="Email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading customers…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
          <p className="text-sm text-muted">
            {search.trim()
              ? "No customers match your search."
              : "Customers will appear here once you have paid orders."}
          </p>
        </div>
      ) : (
        <ResponsiveDataView
          table={
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
              <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Tickets</th>
                <th className="px-4 py-3 text-right">Total spent</th>
                <th className="px-4 py-3">Last order</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {filtered.map((row) => (
                <tr key={row.id} className="text-foreground">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {row.name || row.email || "—"}
                    </div>
                    {row.name && row.email ? (
                      <div className="text-xs text-muted">{row.email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.ordersCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.ticketsCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoneyFromCents(row.totalSpentCents, row.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted tabular-nums">
                    {row.lastOrderAt ? formatShortDateTime(row.lastOrderAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenCustomerId(row.id)}
                      className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                    >
                      View orders
                    </button>
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
                  <p className="font-semibold text-foreground">
                    {row.name || row.email || "—"}
                  </p>
                  {row.name && row.email ? (
                    <p className="text-xs text-muted">{row.email}</p>
                  ) : null}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Orders</dt>
                      <dd className="tabular-nums text-foreground">{row.ordersCount}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wide">Tickets</dt>
                      <dd className="tabular-nums text-foreground">{row.ticketsCount}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="font-semibold uppercase tracking-wide">Spent</dt>
                      <dd className="tabular-nums text-foreground">
                        {formatMoneyFromCents(row.totalSpentCents, row.currency)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => setOpenCustomerId(row.id)}
                    className="mt-3 text-sm font-semibold text-primary"
                  >
                    View orders →
                  </button>
                </li>
              ))}
            </ul>
          }
        />
      )}

      <Dialog
        open={openCustomerId !== null}
        onClose={() => {
          setOpenCustomerId(null);
          setDetail(null);
        }}
        title={detail ? detail.customer.name || detail.customer.email || "Customer" : "Customer"}
      >
        {detailLoading ? (
          <p className="text-sm text-muted">Loading order history…</p>
        ) : detailError ? (
          <p className="text-sm text-red-300" role="alert">
            {detailError}
          </p>
        ) : detail ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-4 text-sm">
              <p className="font-medium text-foreground">{detail.customer.email}</p>
              <p className="mt-1 text-xs text-muted">
                {detail.customer.ordersCount} order
                {detail.customer.ordersCount === 1 ? "" : "s"} · {detail.customer.ticketsCount}{" "}
                ticket{detail.customer.ticketsCount === 1 ? "" : "s"} · total{" "}
                {formatMoneyFromCents(
                  detail.customer.totalSpentCents,
                  detail.customer.currency,
                )}
              </p>
            </div>
            {detail.orders.length === 0 ? (
              <p className="text-sm text-muted">No orders on file.</p>
            ) : (
              <ul className="space-y-2">
                {detail.orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-[var(--radius-panel)] border border-border bg-background/60 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {order.eventTitle}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatMoneyFromCents(order.amountCents, order.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{formatShortDateTime(order.createdAt)}</span>
                      <span aria-hidden>·</span>
                      <span className="uppercase tracking-wide">{order.status}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {order.ticketsInOrder} ticket
                        {order.ticketsInOrder === 1 ? "" : "s"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
