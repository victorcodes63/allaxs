"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import type { AdminPayoutBatchesListPayload, PayoutBatchRow } from "@/lib/organizer-earnings";
import {
  normalizeEligiblePayoutOrganizers,
  type EligiblePayoutOrganizer,
} from "@/lib/admin-payout-eligible";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";
import { ResponsiveDataView } from "@/components/ui/ResponsiveDataView";

function payoutMethodLabel(method: string | null): string {
  if (!method) return "—";
  return method.replace(/_/g, " ");
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<AdminPayoutBatchesListPayload | null>(null);
  const [eligible, setEligible] = useState<EligiblePayoutOrganizer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibleLoading, setEligibleLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [creating, setCreating] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<AdminPayoutBatchesListPayload>(
        "/api/admin/payout-batches?limit=30",
      );
      setData(res.data);
    } catch (e) {
      if (!isAxiosError(e)) throw e;
      const msg = (e.response?.data as { message?: string })?.message;
      throw new Error(msg || "Could not load batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEligible = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const res = await axios.get<unknown>(
        "/api/admin/payout-batches/eligible-organizers",
      );
      setEligible(normalizeEligiblePayoutOrganizers(res.data));
    } catch (e) {
      if (!isAxiosError(e)) throw e;
      const msg = (e.response?.data as { message?: string })?.message;
      throw new Error(msg || "Could not load organizers.");
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadBatches(), loadEligible()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh data.");
    }
  }, [loadBatches, loadEligible]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEligible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((o) => {
      const hay = `${o.orgName} ${o.supportEmail} ${o.userEmail ?? ""} ${o.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [eligible, search]);

  const selectedOrganizers = useMemo(
    () => eligible.filter((o) => selectedIds.has(o.id)),
    [eligible, selectedIds],
  );

  const selectedCurrencies = useMemo(() => {
    const set = new Set(selectedOrganizers.map((o) => o.currency));
    return [...set];
  }, [selectedOrganizers]);

  const selectionTotalCents = useMemo(
    () => selectedOrganizers.reduce((s, o) => s + o.availableCents, 0),
    [selectedOrganizers],
  );

  const selectionCurrency =
    selectedCurrencies.length === 1 ? selectedCurrencies[0] : null;

  const allFilteredSelected =
    filteredEligible.length > 0 &&
    filteredEligible.every((o) => selectedIds.has(o.id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const o of filteredEligible) next.delete(o.id);
      } else {
        for (const o of filteredEligible) next.add(o.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function createDraft() {
    const organizerIds = [...selectedIds];
    if (!organizerIds.length) {
      setError("Select at least one organizer with available balance.");
      return;
    }
    if (selectedCurrencies.length > 1) {
      setError(
        "Selected organizers must share the same currency. Adjust your selection or create separate batches.",
      );
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await axios.post("/api/admin/payout-batches", { organizerIds });
      clearSelection();
      await load();
    } catch (e) {
      if (!isAxiosError(e)) setError("Create failed.");
      else {
        const msg = (e.response?.data as { message?: string | string[] })?.message;
        setError(Array.isArray(msg) ? msg.join(", ") : msg || "Create failed.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={ADMIN_PAGE_SHELL}>
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Finance</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Payout batches
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Draft batches reserve each organizer&apos;s available balance. After your bank run, mark paid
          to post payout lines to ledgers.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">New draft</h2>
        <p className="mt-1 text-xs text-muted">
          Select organizers with available balance. Each line pays out their full available amount.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 max-w-md">
            <Input
              label="Search organizers"
              type="search"
              placeholder="Name, email, or profile ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="button" variant="secondary" className="w-auto shrink-0" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        {selectedOrganizers.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-foreground">
            <span>
              <span className="font-semibold tabular-nums">{selectedOrganizers.length}</span>{" "}
              selected
              {selectionCurrency ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold tabular-nums">
                    {formatMoneyFromCents(selectionTotalCents, selectionCurrency)}
                  </span>{" "}
                  total
                </>
              ) : (
                <span className="text-amber-200"> · mixed currencies</span>
              )}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear selection
            </button>
          </div>
        ) : null}

        {eligibleLoading ? (
          <p className="mt-4 text-sm text-muted">Loading organizers…</p>
        ) : eligible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No organizers currently have available balance to pay out.
          </p>
        ) : filteredEligible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No organizers match your search.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border/80 bg-background/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <input
                  type="checkbox"
                  aria-label={allFilteredSelected ? "Deselect all shown" : "Select all shown"}
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  className="h-4 w-4 rounded border-border bg-surface text-primary focus:ring-primary/30"
                />
                {allFilteredSelected ? "Deselect all shown" : `Select all shown (${filteredEligible.length})`}
              </label>
              <p className="text-xs text-muted tabular-nums">
                {filteredEligible.length} of {eligible.length} with balance
              </p>
            </div>

            <ul className="mt-2 max-h-[min(24rem,50vh)] divide-y divide-border overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-background/30">
              {filteredEligible.map((o) => {
                const checked = selectedIds.has(o.id);
                return (
                  <li key={o.id}>
                    <label
                      className={`flex cursor-pointer gap-3 px-3 py-3 transition-colors sm:px-4 ${
                        checked ? "bg-primary/10" : "hover:bg-surface/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border bg-surface text-primary focus:ring-primary/30"
                        checked={checked}
                        onChange={() => toggleOne(o.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium text-foreground">{o.orgName}</span>
                          {!o.verified ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                              Unverified
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {o.userEmail ?? o.supportEmail}
                          {o.payoutMethod ? ` · ${payoutMethodLabel(o.payoutMethod)}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums text-foreground">
                          {formatMoneyFromCents(o.availableCents, o.currency)}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide text-muted">
                          available
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            className="w-auto"
            disabled={creating || selectedIds.size === 0}
            onClick={() => void createDraft()}
          >
            {creating ? "Creating…" : "Create draft batch"}
          </Button>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-muted">Loading batches…</p>
      ) : data && data.batches.length === 0 ? (
        <p className="text-sm text-muted">No payout batches yet.</p>
      ) : null}

      {data && data.batches.length > 0 ? (
        <ResponsiveDataView
          table={
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background/40">
                  {data.batches.map((b: PayoutBatchRow) => (
                    <tr key={b.id} className="text-foreground">
                      <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs uppercase">
                        {b.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatMoneyFromCents(b.totalCents, b.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted">{b.lines?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/payouts/${b.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
          mobile={
            <ul className="grid gap-4">
              {data.batches.map((b: PayoutBatchRow) => (
                <li
                  key={b.id}
                  className="rounded-[var(--radius-panel)] border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatMoneyFromCents(b.totalCents, b.currency)}
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {new Date(b.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {b.lines?.length ?? 0} line{(b.lines?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                  <Link
                    href={`/admin/payouts/${b.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-primary"
                  >
                    Open batch →
                  </Link>
                </li>
              ))}
            </ul>
          }
        />
      ) : null}
    </div>
  );
}
