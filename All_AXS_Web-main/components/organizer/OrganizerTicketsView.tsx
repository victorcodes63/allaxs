"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  formatShortDateTime,
  normalizeOrganizerSalesSummary,
  type OrganizerSalesEventRow,
} from "@/lib/organizer-sales";
import {
  normalizeOrganizerTickets,
  organizerTicketStatusChipClass,
  type OrganizerTicketRow,
} from "@/lib/organizer-tickets";

const PAGE_SIZE = 25;

function mergeTicketRow(
  list: OrganizerTicketRow[],
  updated: OrganizerTicketRow,
): OrganizerTicketRow[] {
  return list.map((t) => (t.id === updated.id ? updated : t));
}

export function OrganizerTicketsContent(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get("event") ?? "";

  const [eventRows, setEventRows] = useState<OrganizerSalesEventRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [tickets, setTickets] = useState<OrganizerTicketRow[]>([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [listOffset, setListOffset] = useState(0);
  const [filterEventId, setFilterEventId] = useState(eventFromUrl);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<OrganizerTicketRow | null>(null);

  const loadSummary = useCallback(async () => {
    setSummaryError(null);
    try {
      const res = await axios.get<unknown>("/api/organizer/sales/summary");
      const normalized = normalizeOrganizerSalesSummary(res.data);
      if (!normalized) {
        setSummaryError("Unexpected response from sales summary.");
        setEventRows([]);
        return;
      }
      setEventRows(normalized.events);
    } catch (err) {
      if (!isAxiosError(err)) {
        setSummaryError("Could not load events for filters.");
      } else {
        const msg = (err.response?.data as { message?: string })?.message;
        setSummaryError(msg || "Could not load events for filters.");
      }
      setEventRows([]);
    }
  }, []);

  const loadTickets = useCallback(
    async (eventId: string, offset: number, status: string, q: string) => {
      setTicketsError(null);
      setTicketsLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (eventId) qs.set("eventId", eventId);
        if (status) qs.set("status", status);
        if (q.trim()) qs.set("q", q.trim());
        const res = await axios.get<unknown>(`/api/organizer/tickets?${qs.toString()}`);
        const normalized = normalizeOrganizerTickets(res.data);
        if (!normalized) {
          setTicketsError("Unexpected response from tickets.");
          setTickets([]);
          setTicketsTotal(0);
          return;
        }
        setTickets(normalized.tickets);
        setTicketsTotal(normalized.total);
      } catch (err) {
        if (!isAxiosError(err)) {
          setTicketsError("Could not load tickets.");
        } else if (err.code === "ERR_NETWORK" || !err.response) {
          setTicketsError("Network error — check your connection and try again.");
        } else {
          const statusCode = err.response.status;
          const msg = (err.response.data as { message?: string })?.message;
          if (statusCode === 403) {
            setTicketsError(msg || "You do not have access to tickets for that event.");
          } else {
            setTicketsError(msg || "Could not load tickets.");
          }
        }
        setTickets([]);
        setTicketsTotal(0);
      } finally {
        setTicketsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setSummaryLoading(true);
      await loadSummary();
      if (!cancelled) setSummaryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const prevDebouncedQ = useRef(debouncedQ);
  useEffect(() => {
    if (prevDebouncedQ.current !== debouncedQ) {
      prevDebouncedQ.current = debouncedQ;
      setListOffset(0);
    }
  }, [debouncedQ]);

  useEffect(() => {
    void loadTickets(filterEventId, listOffset, statusFilter, debouncedQ);
  }, [filterEventId, listOffset, statusFilter, debouncedQ, loadTickets]);

  useEffect(() => {
    setFilterEventId(eventFromUrl);
    setListOffset(0);
  }, [eventFromUrl]);

  const filterLabel = useMemo(() => {
    if (!filterEventId) return "All events";
    const row = eventRows.find((e) => e.eventId === filterEventId);
    return row?.title ?? "Selected event";
  }, [filterEventId, eventRows]);

  const page = Math.floor(listOffset / PAGE_SIZE);
  const maxPage = Math.max(0, Math.ceil(ticketsTotal / PAGE_SIZE) - 1);

  const patchStatus = async (row: OrganizerTicketRow, status: string) => {
    setActionError(null);
    setBusyId(row.id);
    try {
      const res = await axios.patch<unknown>(`/api/organizer/tickets/${row.id}`, { status });
      const body = res.data as { ticket?: OrganizerTicketRow };
      if (body?.ticket) {
        setTickets((prev) => mergeTicketRow(prev, body.ticket!));
      } else {
        await loadTickets(filterEventId, listOffset, statusFilter, debouncedQ);
      }
    } catch (err) {
      if (!isAxiosError(err)) {
        setActionError("Update failed.");
      } else {
        const msg = (err.response?.data as { message?: string })?.message;
        setActionError(msg || "Update failed.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    await patchStatus(voidTarget, "VOID");
    setVoidTarget(null);
  };

  if (summaryLoading) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading tickets…</p>
        <p className="text-xs text-muted">Door list and check-in</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organiser</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Tickets
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Every issued pass from paid orders across your events. Search by attendee email, buyer email,
              or ticket id. Check guests in at the door or void passes that should not be honoured.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/organizer/tickets/scan">
                <Button variant="primary" className="w-auto min-w-[8.5rem]">
                  Door scan
                </Button>
              </Link>
              <Link href="/organizer/sales">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Sales &amp; orders
                </Button>
              </Link>
              <Link href="/organizer/events">
                <Button variant="secondary" className="w-auto min-w-[8.5rem]">
                  Manage events
                </Button>
              </Link>
            </div>
          </div>
          <aside className="w-full shrink-0 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] lg:max-w-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Check-in</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Mark <span className="font-medium text-foreground">Checked in</span> when the guest arrives.
              Use <span className="font-medium text-foreground">Void</span> for cancelled or fraudulent passes.
              Undo check-in if you scanned the wrong ticket.
            </p>
          </aside>
        </div>
      </header>

      {summaryError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {summaryError}
        </div>
      ) : null}

      <section aria-labelledby="tickets-filters" className="space-y-4">
        <h2 id="tickets-filters" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Filters
        </h2>
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-col gap-2 min-w-[12rem]">
            <label className="text-xs font-medium text-muted" htmlFor="tickets-event-filter">
              Event
            </label>
            <select
              id="tickets-event-filter"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              value={filterEventId}
              onChange={(e) => {
                const v = e.target.value;
                setListOffset(0);
                setFilterEventId(v);
                if (v) {
                  router.replace(`/organizer/tickets?event=${encodeURIComponent(v)}`);
                } else {
                  router.replace("/organizer/tickets");
                }
              }}
            >
              <option value="">All events</option>
              {eventRows.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 min-w-[11rem]">
            <label className="text-xs font-medium text-muted" htmlFor="tickets-status-filter">
              Ticket status
            </label>
            <select
              id="tickets-status-filter"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              value={statusFilter}
              onChange={(e) => {
                setListOffset(0);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="ISSUED">Issued</option>
              <option value="CHECKED_IN">Checked in</option>
              <option value="VOID">Void</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-2 min-w-[14rem] max-w-xl">
            <label className="text-xs font-medium text-muted" htmlFor="tickets-search">
              Search
            </label>
            <input
              id="tickets-search"
              type="search"
              placeholder="Email, name, ticket id, order id…"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          Showing passes for <span className="font-medium text-foreground">{filterLabel}</span>
          {statusFilter ? (
            <>
              {" "}
              · status{" "}
              <span className="font-medium text-foreground">{statusFilter.replace(/_/g, " ")}</span>
            </>
          ) : null}
          .
        </p>
      </section>

      {actionError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {ticketsError ? (
        <div
          className="rounded-[var(--radius-panel)] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {ticketsError}
        </div>
      ) : null}

      {ticketsLoading ? (
        <p className="text-sm text-muted">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted">No tickets match this selection.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {tickets.map((t) => (
                <tr key={t.id} className="align-top text-foreground">
                  <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                    {formatShortDateTime(t.issuedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[11rem] truncate font-medium">{t.eventTitle}</div>
                    {t.eventSlug ? (
                      <div className="max-w-[11rem] truncate text-[10px] text-muted">{t.eventSlug}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-[9rem]">{t.tierName}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-[12rem] truncate text-sm">{t.attendeeEmail || t.buyerEmail}</div>
                    {t.attendeeName ? (
                      <div className="max-w-[12rem] truncate text-xs text-muted">{t.attendeeName}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] text-muted break-all">{t.orderId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={organizerTicketStatusChipClass(t.status)}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {t.status === "ISSUED" ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-auto px-2 py-1 text-xs min-h-0"
                            disabled={busyId === t.id}
                            onClick={() => void patchStatus(t, "CHECKED_IN")}
                          >
                            Check in
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-auto px-2 py-1 text-xs min-h-0 border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
                            disabled={busyId === t.id}
                            onClick={() => setVoidTarget(t)}
                          >
                            Void
                          </Button>
                        </>
                      ) : null}
                      {t.status === "CHECKED_IN" ? (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-auto px-2 py-1 text-xs min-h-0"
                            disabled={busyId === t.id}
                            onClick={() => void patchStatus(t, "ISSUED")}
                          >
                            Undo
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-auto px-2 py-1 text-xs min-h-0 border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
                            disabled={busyId === t.id}
                            onClick={() => setVoidTarget(t)}
                          >
                            Void
                          </Button>
                        </>
                      ) : null}
                      {t.status === "VOID" ? (
                        <span className="text-xs text-muted py-1 inline-block">Voided</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ticketsTotal > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4 text-sm">
          <p className="text-muted">
            Page <span className="font-medium text-foreground">{page + 1}</span> of{" "}
            <span className="font-medium text-foreground">{maxPage + 1}</span> ·{" "}
            <span className="tabular-nums">{ticketsTotal}</span> tickets
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-auto"
              disabled={listOffset <= 0 || ticketsLoading}
              onClick={() => setListOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-auto"
              disabled={page >= maxPage || ticketsLoading}
              onClick={() => setListOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title="Void this ticket?"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" className="w-auto" onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="w-auto border-rose-600/40 bg-rose-600 hover:bg-rose-500"
              disabled={busyId !== null}
              onClick={() => void confirmVoid()}
            >
              Void ticket
            </Button>
          </div>
        }
      >
        {voidTarget ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              This cannot be undone. The guest will no longer be able to use this pass for{" "}
              <span className="font-medium text-foreground">{voidTarget.eventTitle}</span>.
            </p>
            <p className="font-mono text-xs break-all text-foreground/80">{voidTarget.id}</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
