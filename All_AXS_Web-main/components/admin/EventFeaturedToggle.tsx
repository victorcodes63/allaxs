"use client";

import { useCallback, useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";

interface EventFeaturedToggleProps {
  eventId: string;
  initialIsFeatured: boolean;
  initialFeaturedSortOrder?: number | null;
  /** Only published events appear on the homepage rail. */
  isPublished: boolean;
  onUpdated?: (next: { isFeatured: boolean; featuredSortOrder: number | null }) => void;
}

export function EventFeaturedToggle({
  eventId,
  initialIsFeatured,
  initialFeaturedSortOrder = null,
  isPublished,
  onUpdated,
}: EventFeaturedToggleProps) {
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured);
  const [sortOrder, setSortOrder] = useState(
    initialFeaturedSortOrder != null ? String(initialFeaturedSortOrder) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIsFeatured(initialIsFeatured);
    setSortOrder(
      initialFeaturedSortOrder != null ? String(initialFeaturedSortOrder) : "",
    );
  }, [initialIsFeatured, initialFeaturedSortOrder, eventId]);

  const persist = useCallback(
    async (nextFeatured: boolean, nextSortRaw: string) => {
      setSaving(true);
      setError(null);
      setSaved(false);

      const parsedSort =
        nextSortRaw.trim() === "" ? null : Number.parseInt(nextSortRaw, 10);
      if (nextSortRaw.trim() !== "" && Number.isNaN(parsedSort)) {
        setError("Sort order must be a whole number.");
        setSaving(false);
        return;
      }
      if (parsedSort != null && parsedSort < 0) {
        setError("Sort order cannot be negative.");
        setSaving(false);
        return;
      }

      try {
        const response = await axios.patch(`/api/events/${eventId}`, {
          isFeatured: nextFeatured,
          featuredSortOrder: nextFeatured ? parsedSort : null,
        });
        const data = response.data as {
          isFeatured?: boolean;
          featuredSortOrder?: number | null;
        };
        const resolvedFeatured = data.isFeatured ?? nextFeatured;
        const resolvedSort = data.featuredSortOrder ?? parsedSort;
        setIsFeatured(resolvedFeatured);
        setSortOrder(resolvedSort != null ? String(resolvedSort) : "");
        setSaved(true);
        onUpdated?.({
          isFeatured: resolvedFeatured,
          featuredSortOrder: resolvedSort,
        });
      } catch (err) {
        const message = isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message ||
            err.message
          : "Failed to update featured settings.";
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [eventId, onUpdated],
  );

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">
            Homepage featured
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Curate this event for the public homepage rail. Lower sort values appear first.
          </p>
        </div>
        {!isPublished ? (
          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-500/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
            Publish to show on home
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={isFeatured}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.checked;
              setIsFeatured(next);
              void persist(next, sortOrder);
            }}
          />
          Featured on homepage
        </label>

        <div className="flex flex-1 flex-col gap-1.5 sm:max-w-[10rem]">
          <label
            htmlFor={`featured-sort-${eventId}`}
            className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted"
          >
            Sort order
          </label>
          <input
            id={`featured-sort-${eventId}`}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Optional"
            value={sortOrder}
            disabled={saving || !isFeatured}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={saving || !isFeatured}
          onClick={() => void persist(isFeatured, sortOrder)}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save order"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-200">{error}</p>
      ) : saved ? (
        <p className="mt-3 text-sm text-emerald-200">Featured settings saved.</p>
      ) : null}
    </div>
  );
}
