"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import { formatShortDateTime } from "@/lib/organizer-sales";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";
import { ResponsiveDataView } from "@/components/ui/ResponsiveDataView";

interface WaitlistEntry {
  id: string;
  eventId: string;
  eventTitle: string;
  email: string;
  name: string;
  phone: string | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  status: "PENDING" | "NOTIFIED" | "CONVERTED" | "CANCELLED";
  createdAt: string;
}

interface OrganizerEventOption {
  id: string;
  title: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeEntry(raw: unknown): WaitlistEntry | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  const status = ["PENDING", "NOTIFIED", "CONVERTED", "CANCELLED"].includes(
    typeof raw.status === "string" ? raw.status : "",
  )
    ? (raw.status as WaitlistEntry["status"])
    : "PENDING";
  return {
    id,
    eventId: typeof raw.eventId === "string" ? raw.eventId : "",
    eventTitle: typeof raw.eventTitle === "string" ? raw.eventTitle : "Event",
    email: typeof raw.email === "string" ? raw.email : "",
    name: typeof raw.name === "string" ? raw.name : "",
    phone: typeof raw.phone === "string" ? raw.phone : null,
    ticketTypeId:
      typeof raw.ticketTypeId === "string" ? raw.ticketTypeId : null,
    ticketTypeName:
      typeof raw.ticketTypeName === "string" ? raw.ticketTypeName : null,
    status,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
  };
}

const STATUS_TONE: Record<WaitlistEntry["status"], string> = {
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  NOTIFIED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  CONVERTED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  CANCELLED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

export default function OrganizerWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [events, setEvents] = useState<OrganizerEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (eventFilter) params.set("eventId", eventFilter);
      const [waitRes, eventsRes] = await Promise.all([
        axios.get<unknown>(
          `/api/organizer/waitlist${params.toString() ? `?${params.toString()}` : ""}`,
        ),
        axios.get<unknown>("/api/events"),
      ]);

      const waitlistRows = Array.isArray(waitRes.data)
        ? waitRes.data
        : isRecord(waitRes.data) && Array.isArray(waitRes.data.entries)
          ? waitRes.data.entries
          : [];
      setEntries(
        waitlistRows
          .map(normalizeEntry)
          .filter((e): e is WaitlistEntry => e !== null),
      );

      const eventList = normalizeOrganizerEventsListPayload<OrganizerEventOption>(
        eventsRes.data,
      );
      setEvents(eventList.filter((e) => e.id && e.title));
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load waitlist entries.");
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!eventFilter) return entries;
    return entries.filter((e) => e.eventId === eventFilter);
  }, [entries, eventFilter]);

  const showBanner = (msg: string) => {
    setBanner(msg);
    window.setTimeout(() => setBanner(null), 4000);
  };

  const cancelEntry = async (id: string) => {
    if (!confirm("Cancel this waitlist entry?")) return;
    setBusyId(id);
    try {
      await axios.delete(`/api/organizer/waitlist/${id}`);
      showBanner("Entry cancelled.");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not cancel the entry.");
    } finally {
      setBusyId(null);
    }
  };

  const notifyEntry = async (id: string) => {
    setBusyId(id);
    try {
      await axios.post(`/api/organizer/waitlist/${id}/notify`);
      showBanner("Notification sent.");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not notify the entry.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Organiser
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Waitlist
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Fans waiting for tickets when an event or tier is sold out. Notify them
          to release a code or cancel an entry if their slot was already filled.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <label className="block text-sm font-medium text-foreground">
            Filter by event
          </label>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className={`${nativeDarkControlClass(false)} mt-1`}
          >
            <option value="">All events</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
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

      {banner ? (
        <div
          className="rounded-[var(--radius-panel)] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          role="status"
        >
          {banner}
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading waitlist…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
          <p className="text-sm text-muted">
            No waitlist entries for the current filter. We&apos;ll list anyone who
            opts in here.
          </p>
        </div>
      ) : (
        <ResponsiveDataView
          table={
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
              <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Tier</th>
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
                  <td className="px-4 py-3">{row.eventTitle}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name || row.email}</div>
                    {row.name && row.email ? (
                      <div className="text-xs text-muted">{row.email}</div>
                    ) : null}
                    {row.phone ? (
                      <div className="text-xs text-muted">{row.phone}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {row.ticketTypeName ?? "Any tier"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[row.status]}`}
                    >
                      {row.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.status === "PENDING" || row.status === "NOTIFIED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void notifyEntry(row.id)}
                          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
                        >
                          Notify
                        </button>
                      ) : null}
                      {row.status !== "CANCELLED" &&
                      row.status !== "CONVERTED" ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void cancelEntry(row.id)}
                          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
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
                  <p className="font-semibold text-foreground">{row.eventTitle}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {row.name || row.email}
                  </p>
                  {row.email && row.name ? (
                    <p className="text-xs text-muted">{row.email}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    {row.ticketTypeName ?? "Any tier"} ·{" "}
                    {row.createdAt ? formatShortDateTime(row.createdAt) : "—"}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_TONE[row.status]}`}
                  >
                    {row.status.toLowerCase()}
                  </span>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {row.status === "PENDING" || row.status === "NOTIFIED" ? (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void notifyEntry(row.id)}
                        className="text-xs font-semibold text-primary disabled:opacity-50"
                      >
                        Notify
                      </button>
                    ) : null}
                    {row.status !== "CANCELLED" && row.status !== "CONVERTED" ? (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void cancelEntry(row.id)}
                        className="text-xs font-semibold text-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}
