"use client";

import { useCallback, useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import { normalizeCurrencyCode } from "@/lib/currency";
import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";

type AffiliateStatus = "ACTIVE" | "PAUSED" | "DISABLED";

interface AffiliateRow {
  id: string;
  code: string;
  name: string;
  eventId: string | null;
  eventTitle: string | null;
  status: AffiliateStatus;
  /** Whole percentage (e.g. 10 = 10%). */
  commissionPercent: number;
  ordersCount: number;
  conversionsCount: number;
  visits: number;
  revenueCents: number;
  currency: string;
}

interface OrganizerEventOption {
  id: string;
  title: string;
}

const STATUS_TONE: Record<AffiliateStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  PAUSED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  DISABLED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceStatus(v: unknown): AffiliateStatus {
  if (v === "PAUSED" || v === "DISABLED") return v;
  return "ACTIVE";
}

function normalizeAffiliate(raw: unknown): AffiliateRow | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const code = typeof raw.code === "string" ? raw.code : null;
  if (!id || !code) return null;
  return {
    id,
    code,
    name: typeof raw.name === "string" ? raw.name : "",
    eventId: typeof raw.eventId === "string" ? raw.eventId : null,
    eventTitle: typeof raw.eventTitle === "string" ? raw.eventTitle : null,
    status: coerceStatus(raw.status),
    commissionPercent:
      typeof raw.commissionPercent === "number" ? raw.commissionPercent : 0,
    ordersCount: typeof raw.ordersCount === "number" ? raw.ordersCount : 0,
    conversionsCount:
      typeof raw.conversionsCount === "number" ? raw.conversionsCount : 0,
    visits: typeof raw.visits === "number" ? raw.visits : 0,
    revenueCents:
      typeof raw.revenueCents === "number" ? raw.revenueCents : 0,
    currency: normalizeCurrencyCode(
      typeof raw.currency === "string" ? raw.currency : undefined,
    ),
  };
}

export default function OrganizerAffiliatesPage() {
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [events, setEvents] = useState<OrganizerEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createCode, setCreateCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEvent, setCreateEvent] = useState<string>("");
  const [createPercent, setCreatePercent] = useState<string>("10");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [affRes, eventsRes] = await Promise.all([
        axios.get<unknown>("/api/organizer/affiliates"),
        axios.get<unknown>("/api/events"),
      ]);
      const list = Array.isArray(affRes.data)
        ? affRes.data
        : isRecord(affRes.data) && Array.isArray(affRes.data.affiliates)
          ? affRes.data.affiliates
          : [];
      setRows(
        list
          .map(normalizeAffiliate)
          .filter((r): r is AffiliateRow => r !== null),
      );
      setEvents(
        normalizeOrganizerEventsListPayload<OrganizerEventOption>(eventsRes.data)
          .filter((e) => e.id && e.title),
      );
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not load affiliates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async () => {
    setCreateError(null);
    if (!createCode.trim()) {
      setCreateError("Code is required.");
      return;
    }
    const percent = Number(createPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setCreateError("Commission percent must be between 0 and 100.");
      return;
    }
    setCreateBusy(true);
    try {
      await axios.post("/api/organizer/affiliates", {
        code: createCode.trim(),
        name: createName.trim() || undefined,
        eventId: createEvent || undefined,
        commissionPercent: percent,
      });
      setCreating(false);
      setCreateCode("");
      setCreateName("");
      setCreateEvent("");
      setCreatePercent("10");
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setCreateError(msg || "Could not create affiliate.");
    } finally {
      setCreateBusy(false);
    }
  };

  const setStatus = async (row: AffiliateRow, status: AffiliateStatus) => {
    setBusyId(row.id);
    try {
      await axios.patch(`/api/organizer/affiliates/${row.id}`, { status });
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not update affiliate.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: AffiliateRow) => {
    if (!confirm(`Remove affiliate code "${row.code}"?`)) return;
    setBusyId(row.id);
    try {
      await axios.delete(`/api/organizer/affiliates/${row.id}`);
      void load();
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message
        : null;
      setError(msg || "Could not remove affiliate.");
    } finally {
      setBusyId(null);
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
            Affiliates
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Create promo codes for partners. Track conversions and revenue
            attributed to each code, and pause or remove them at any time.
          </p>
        </div>
        <Button type="button" className="w-auto" onClick={() => setCreating(true)}>
          New affiliate
        </Button>
      </header>

      {error ? (
        <div
          className="rounded-[var(--radius-panel)] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading affiliates…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-8 text-center sm:p-10">
          <p className="text-sm text-muted">
            No affiliate codes yet. Create one to start tracking referrals from
            ambassadors, influencers, or partner sites.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-surface/80 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Code / name</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Visits</th>
                <th className="px-4 py-3 text-right">Conversions</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/40">
              {rows.map((row) => {
                const conversionRate =
                  row.visits > 0 ? row.conversionsCount / row.visits : 0;
                return (
                  <tr key={row.id} className="text-foreground align-top">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm text-foreground">{row.code}</div>
                      {row.name ? (
                        <div className="text-xs text-muted">{row.name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {row.eventTitle ?? "All events"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.commissionPercent}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.visits}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.conversionsCount}
                      {row.visits > 0 ? (
                        <span className="ml-1 text-xs text-muted">
                          ({(conversionRate * 100).toFixed(1)}%)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoneyFromCents(row.revenueCents, row.currency)}
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
                        {row.status === "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, "PAUSED")}
                            className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-50"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, "ACTIVE")}
                            className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void remove(row)}
                          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={creating}
        onClose={() => {
          if (createBusy) return;
          setCreating(false);
        }}
        title="New affiliate code"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={createBusy}
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createBusy}
              onClick={() => void submitCreate()}
            >
              {createBusy ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <Input
            label="Code"
            placeholder="e.g. AMBASSADOR10"
            value={createCode}
            onChange={(e) => setCreateCode(e.target.value)}
          />
          <Input
            label="Friendly name (optional)"
            placeholder="Ambassador A"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Event scope
            </label>
            <select
              value={createEvent}
              onChange={(e) => setCreateEvent(e.target.value)}
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
          <Input
            label="Commission %"
            type="number"
            min={0}
            max={100}
            step={1}
            value={createPercent}
            onChange={(e) => setCreatePercent(e.target.value)}
          />
          {createError ? (
            <p className="text-sm text-primary" role="alert">
              {createError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
