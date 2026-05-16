"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { CouponFormDialog } from "@/components/organizer/coupons/CouponFormDialog";
import {
  deleteCoupon,
  deriveCouponLifecycle,
  formatCouponValue,
  listCoupons,
  type Coupon,
  type CouponLifecycle,
} from "@/lib/coupons-api";

interface EventCouponsTabProps {
  eventId: string;
  /** Currency the event sells in (defaults the create form). */
  defaultCurrency?: string;
  /**
   * Admin override: when true, the tab assumes the actor is an admin
   * editing on behalf of an organizer. Used by the admin editor page.
   */
  canEditOverride?: boolean;
}

const LIFECYCLE_LABEL: Record<CouponLifecycle, string> = {
  ACTIVE: "Active",
  INACTIVE: "Disabled",
  SCHEDULED: "Scheduled",
  EXPIRED: "Expired",
  EXHAUSTED: "Sold out",
};

const LIFECYCLE_TONE: Record<CouponLifecycle, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  INACTIVE: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
  SCHEDULED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  EXPIRED: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  EXHAUSTED: "bg-primary/10 text-primary border-primary/30",
};

function formatRange(c: Coupon): string {
  const fmt = (s?: string) =>
    s
      ? new Date(s).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
  const start = fmt(c.startAt);
  const end = fmt(c.endAt);
  if (!start && !end) return "Always valid";
  if (start && end) return `${start} → ${end}`;
  if (start) return `From ${start}`;
  return `Until ${end}`;
}

export function EventCouponsTab({
  eventId,
  defaultCurrency = "KES",
}: EventCouponsTabProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCoupons(eventId);
      setCoupons(rows);
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (status === 403) {
          setError("You do not have permission to view coupons for this event.");
        } else if (status === 404) {
          setError("Event not found.");
        } else {
          setError(
            (err.response?.data as { message?: string } | undefined)?.message ||
              err.message ||
              "Failed to load coupons.",
          );
        }
      } else {
        setError("Failed to load coupons.");
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = (saved: Coupon) => {
    setCoupons((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setDialogOpen(false);
    setEditing(null);
    setBannerMessage(
      editing
        ? `Coupon “${saved.code}” updated.`
        : `Coupon “${saved.code}” created.`,
    );
    window.setTimeout(() => setBannerMessage(null), 4000);
  };

  const handleRemove = async (coupon: Coupon) => {
    const confirmCopy =
      coupon.usedCount > 0
        ? `“${coupon.code}” has been redeemed ${coupon.usedCount} time${
            coupon.usedCount === 1 ? "" : "s"
          }. It will be disabled (active = false) but the history will remain. Continue?`
        : `Delete coupon “${coupon.code}”? This cannot be undone.`;
    if (!window.confirm(confirmCopy)) return;
    setRemovingId(coupon.id);
    try {
      const res = await deleteCoupon(coupon.id);
      if (res.deleted) {
        setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        setBannerMessage(`Coupon “${coupon.code}” deleted.`);
      } else {
        setCoupons((prev) =>
          prev.map((c) =>
            c.id === coupon.id ? { ...c, active: false } : c,
          ),
        );
        setBannerMessage(`Coupon “${coupon.code}” disabled.`);
      }
      window.setTimeout(() => setBannerMessage(null), 4000);
    } catch (err) {
      const fallback = "Failed to remove coupon. Please try again.";
      if (isAxiosError(err)) {
        const apiMessage = (err.response?.data as { message?: string } | undefined)
          ?.message;
        setError(apiMessage ?? err.message ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setRemovingId(null);
    }
  };

  const sortedCoupons = useMemo(() => {
    return [...coupons].sort((a, b) => {
      // Active first, then by createdAt desc.
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [coupons]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Coupons</h3>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Create promo codes for this event. Buyers enter the code at
            checkout and the discount is applied before the platform fee.
            One coupon per order.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="w-auto"
        >
          Create coupon
        </Button>
      </header>

      {bannerMessage && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          {bannerMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/40 p-6 text-sm text-muted">
          Loading coupons…
        </div>
      ) : sortedCoupons.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-border bg-surface/40 p-8 text-center">
          <p className="text-sm font-medium text-foreground">No coupons yet</p>
          <p className="mt-1 text-sm text-muted">
            Create your first promo code to drive early sign-ups or reward
            invited guests.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sortedCoupons.map((c) => {
            const lifecycle = deriveCouponLifecycle(c);
            const usageLabel =
              typeof c.usageLimit === "number"
                ? `${c.usedCount} / ${c.usageLimit} used`
                : `${c.usedCount} used`;
            const perUserLabel =
              typeof c.perUserLimit === "number"
                ? `${c.perUserLimit} per buyer`
                : "No per-buyer cap";
            const minOrderLabel =
              typeof c.minOrderCents === "number" && c.minOrderCents > 0
                ? `Min order ${(c.minOrderCents / 100).toFixed(0)} ${
                    c.currency || "KES"
                  }`
                : "No minimum";
            return (
              <li
                key={c.id}
                className="rounded-[var(--radius-panel)] border border-border bg-surface/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-semibold text-foreground">
                        {c.code}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LIFECYCLE_TONE[lifecycle]}`}
                      >
                        {LIFECYCLE_LABEL[lifecycle]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatCouponValue(c)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatRange(c)} · {usageLabel} · {perUserLabel} · {minOrderLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                      className="w-auto"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleRemove(c)}
                      disabled={removingId === c.id}
                      className="w-auto"
                    >
                      {removingId === c.id
                        ? "…"
                        : c.usedCount > 0
                          ? "Disable"
                          : "Delete"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CouponFormDialog
        open={dialogOpen}
        coupon={editing}
        eventId={eventId}
        defaultCurrency={defaultCurrency}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}
