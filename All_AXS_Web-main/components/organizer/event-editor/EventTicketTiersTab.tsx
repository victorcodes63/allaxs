"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ticketTierSchema,
  type TicketTierInput,
  EventStatus,
} from "@/lib/validation/event";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { apiClient } from "@/lib/api-client";

const baseTicketTierResolver = zodResolver(ticketTierSchema);

/**
 * react-hook-form's `useFieldArray("installmentConfig.splits")` silently
 * materialises `installmentConfig = { splits: [] }` in form state even when
 * the user hasn't toggled installments on. zod then runs the full
 * `installmentConfigSchema` against that stub and produces phantom errors
 * (`mode required`, `min 2 splits`) that the user can't act on because the
 * installments section is collapsed. Strip the stub before the schema sees
 * it so the gate is solely `allowInstallments`.
 */
const ticketTierResolver: Resolver<TicketTierInput> = (
  values,
  context,
  options,
) => {
  const sanitized = values?.allowInstallments
    ? values
    : { ...values, installmentConfig: undefined };
  return baseTicketTierResolver(sanitized, context, options);
};

interface InstallmentConfig {
  mode: "PERCENT_SPLITS";
  splits: Array<{ seq: number; pct: number; dueAfterDays: number }>;
  minDepositPct?: number;
  gracePeriodDays?: number;
  autoCancelOnDefault?: boolean;
}

interface TicketType {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  maxPerOrder?: number;
  salesStart?: string;
  salesEnd?: string;
  currency: string;
  allowInstallments?: boolean;
  installmentConfig?: InstallmentConfig | null;
  [key: string]: unknown;
}

interface Event {
  id: string;
  title?: string;
  type?: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  status: string;
  slug?: string;
  startAt: string;
  endAt: string;
  description?: string;
  bannerUrl?: string | null;
  ticketTypes?: TicketType[];
  [key: string]: unknown;
}

interface EventTicketTiersTabProps {
  event: Event;
  onEventUpdate: (event: Event) => void;
  /**
   * Set by the admin editor so admins can mutate tiers on any status
   * (including PUBLISHED beyond the price-only window organisers have).
   * Backend audit-logs each mutation as ADMIN_(CREATE|UPDATE|DELETE)_TICKET_TYPE.
   */
  canEditOverride?: boolean;
}

type TierPreset = {
  id: string;
  label: string;
  hint: string;
  defaults: Partial<TicketTierInput>;
};

const TIER_PRESETS: TierPreset[] = [
  {
    id: "general",
    label: "General Admission",
    hint: "Most events start here.",
    defaults: { name: "General Admission", priceCents: 1500, quantity: 200 },
  },
  {
    id: "vip",
    label: "VIP",
    hint: "Higher price, smaller allotment.",
    defaults: {
      name: "VIP",
      description: "Priority entry and reserved seating.",
      priceCents: 5000,
      quantity: 50,
      maxPerOrder: 4,
    },
  },
  {
    id: "early",
    label: "Early Bird",
    hint: "Discounted, sells out by a date.",
    defaults: {
      name: "Early Bird",
      description: "Limited release at a discounted price.",
      priceCents: 1000,
      quantity: 100,
    },
  },
  {
    id: "free",
    label: "Free RSVP",
    hint: "Capture leads with a no-cost ticket.",
    defaults: {
      name: "Free RSVP",
      priceCents: 0,
      quantity: 250,
      maxPerOrder: 2,
    },
  },
];

type TierStatus =
  | "draft"
  | "scheduled"
  | "on_sale"
  | "sold_out"
  | "ended"
  | "free";

function tierStatus(tier: TicketType, eventStatus: string): TierStatus {
  if (eventStatus === EventStatus.DRAFT) return "draft";
  const now = Date.now();
  const start = tier.salesStart ? Date.parse(tier.salesStart) : null;
  const end = tier.salesEnd ? Date.parse(tier.salesEnd) : null;
  const soldOut = tier.quantitySold >= tier.quantityTotal && tier.quantityTotal > 0;
  if (soldOut) return "sold_out";
  if (end && now > end) return "ended";
  if (start && now < start) return "scheduled";
  if (tier.priceCents === 0) return "free";
  return "on_sale";
}

function statusChip(status: TierStatus): string {
  switch (status) {
    case "on_sale":
      return "border border-emerald-400/30 bg-emerald-500/12 text-emerald-100";
    case "free":
      return "border border-sky-400/25 bg-sky-500/15 text-sky-100";
    case "scheduled":
      return "border border-amber-400/25 bg-amber-500/15 text-amber-100";
    case "sold_out":
      return "border border-red-400/30 bg-red-500/12 text-red-100";
    case "ended":
      return "border border-white/10 bg-white/[0.04] text-muted";
    case "draft":
    default:
      return "border border-white/10 bg-white/[0.06] text-foreground/80";
  }
}

function statusLabel(status: TierStatus): string {
  switch (status) {
    case "on_sale":
      return "On sale";
    case "free":
      return "Free";
    case "scheduled":
      return "Scheduled";
    case "sold_out":
      return "Sold out";
    case "ended":
      return "Ended";
    case "draft":
      return "Draft";
  }
}

function formatPrice(cents: number, currency = "KES"): string {
  if (cents === 0) return "Free";
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${amount}`;
}

function formatRelativeWindow(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

/**
 * `<input type="datetime-local">` emits `YYYY-MM-DDTHH:mm` (no seconds,
 * no timezone). Backend `IsDateString` requires a proper ISO 8601 string,
 * so coerce via Date.
 */
function toIsoStringOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * NestJS / class-validator returns errors as either `{ message: "..." }` or
 * `{ message: ["a", "b"] }` (the array form is the default for ValidationPipe
 * with `disableErrorMessages: false`). Normalise so the UI always shows
 * something readable instead of `[object Object]` or `undefined`.
 */
function extractApiMessage(err: unknown): string | undefined {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) return undefined;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return undefined;
  const msg = (data as { message?: unknown }).message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg))
    return msg.filter((m) => typeof m === "string").join("; ") || undefined;
  const errMsg = (data as { error?: unknown }).error;
  return typeof errMsg === "string" ? errMsg : undefined;
}

/**
 * react-hook-form's `errors` object hides field paths behind getters and arrays,
 * so a top-level `Object.keys` returns an empty list (or just `["root"]`) for
 * nested failures like `installmentConfig.splits.0.pct`. Walk the tree and
 * return dotted paths so we can both log usefully and scroll to the offending
 * input by `name="..."`.
 */
function collectFieldErrorPaths(errors: unknown, prefix = ""): string[] {
  if (!errors || typeof errors !== "object") return [];
  const out: string[] = [];
  for (const key of Object.keys(errors as Record<string, unknown>)) {
    if (key === "root") continue;
    const value = (errors as Record<string, unknown>)[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value &&
      typeof value === "object" &&
      "message" in (value as Record<string, unknown>) &&
      typeof (value as { message?: unknown }).message === "string"
    ) {
      out.push(path);
    } else if (value && typeof value === "object") {
      out.push(...collectFieldErrorPaths(value, path));
    }
  }
  return out;
}

export function EventTicketTiersTab({
  event,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEventUpdate: _onEventUpdate,
  canEditOverride = false,
}: EventTicketTiersTabProps) {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presetDefaults, setPresetDefaults] = useState<Partial<TicketTierInput> | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditable =
    canEditOverride ||
    event.status === EventStatus.DRAFT ||
    event.status === EventStatus.PENDING_REVIEW ||
    event.status === EventStatus.REJECTED;
  const isPublished = event.status === EventStatus.PUBLISHED;
  const canPriceEditPublished = isPublished;
  const canEditAnyField = isEditable;
  const canSubmitEdits = canEditAnyField || canPriceEditPublished;

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get(`/events/${event.id}/ticket-types`);
      setTicketTypes(response.data || []);
    } catch (err) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 404) setTicketTypes([]);
      else throw err;
    }
  }, [event.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await refresh();
      } catch (err) {
        if (cancelled) return;
        const message =
          extractApiMessage(err) || "Failed to load ticket types";
        setError(message);
        if (process.env.NODE_ENV !== "production") {
          console.debug("[EventTicketTiersTab] load failed", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (event.id) void load();
    return () => {
      cancelled = true;
    };
  }, [event.id, refresh]);

  const summary = useMemo(() => {
    let total = 0;
    let sold = 0;
    let revenue = 0;
    let active = 0;
    const now = Date.now();
    for (const tier of ticketTypes) {
      total += tier.quantityTotal;
      sold += tier.quantitySold;
      revenue += tier.priceCents * tier.quantityTotal;
      const start = tier.salesStart ? Date.parse(tier.salesStart) : null;
      const end = tier.salesEnd ? Date.parse(tier.salesEnd) : null;
      const inWindow = (!start || now >= start) && (!end || now <= end);
      if (inWindow && tier.quantitySold < tier.quantityTotal) active += 1;
    }
    return { total, sold, revenue, active };
  }, [ticketTypes]);

  const startCreate = (defaults?: Partial<TicketTierInput>) => {
    setPresetDefaults(defaults ?? null);
    setEditingId("new");
    setError(null);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setPresetDefaults(null);
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setPresetDefaults(null);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!canEditAnyField) {
      setError("Ticket tiers cannot be edited in the current event status");
      return;
    }
    if (
      !confirm(
        "Delete this ticket tier? Existing buyers keep their tickets but the tier will no longer be on sale.",
      )
    ) {
      return;
    }
    setError(null);
    try {
      await apiClient.delete(`/ticket-types/${id}`);
      await refresh();
      setSuccess("Ticket tier deleted");
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      const apiError = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (apiError.response?.status === 403)
        setError("You do not have permission to delete tiers for this event");
      else if (apiError.response?.status === 404)
        setError("Ticket tier not found");
      else
        setError(
          apiError.response?.data?.message || "Failed to delete ticket tier",
        );
    }
  };

  const handleDuplicate = (tier: TicketType) => {
    if (!canEditAnyField) return;
    startCreate({
      name: `${tier.name} (copy)`,
      description: tier.description ?? "",
      priceCents: tier.priceCents / 100,
      quantity: tier.quantityTotal,
      maxPerOrder: tier.maxPerOrder,
      salesStartAt: tier.salesStart
        ? new Date(tier.salesStart).toISOString().slice(0, 16)
        : "",
      salesEndAt: tier.salesEnd
        ? new Date(tier.salesEnd).toISOString().slice(0, 16)
        : "",
      allowInstallments: tier.allowInstallments ?? false,
      installmentConfig: tier.installmentConfig
        ? {
            mode: "PERCENT_SPLITS" as const,
            splits: tier.installmentConfig.splits ?? [],
            minDepositPct: tier.installmentConfig.minDepositPct,
            gracePeriodDays: tier.installmentConfig.gracePeriodDays,
            autoCancelOnDefault:
              tier.installmentConfig.autoCancelOnDefault ?? false,
          }
        : undefined,
    });
  };

  // Inline quantity stepper: optimistic update + debounced PATCH.
  const pendingQty = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const handleQuantityChange = useCallback(
    (id: string, nextQuantity: number) => {
      if (!canEditAnyField) return;
      const tier = ticketTypes.find((t) => t.id === id);
      if (!tier) return;
      const clamped = Math.max(tier.quantitySold, Math.round(nextQuantity));
      setTicketTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, quantityTotal: clamped } : t)),
      );
      const existing = pendingQty.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(async () => {
        try {
          await apiClient.patch(`/ticket-types/${id}`, { quantity: clamped });
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[EventTicketTiersTab] quantity PATCH failed", err);
          }
          setError("Could not update inventory. Refreshing the list.");
          await refresh();
        }
      }, 700);
      pendingQty.current.set(id, timer);
    },
    [canEditAnyField, refresh, ticketTypes],
  );

  useEffect(() => {
    const map = pendingQty.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const onSubmit = async (data: TicketTierInput) => {
    if (!canSubmitEdits) {
      setError("Ticket tiers cannot be edited in the current event status");
      return;
    }
    if (canPriceEditPublished && editingId === "new") {
      setError(
        "Published events allow price edits only. Add new tiers before publishing.",
      );
      return;
    }
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const eventEnd = new Date(event.endAt);
      // <input type="datetime-local"> emits `YYYY-MM-DDTHH:mm` (no seconds, no
      // timezone), which the backend's class-validator `IsDateString` rejects.
      // Normalise to a real ISO 8601 string before validating windows or
      // posting.
      const salesStartIso = data.salesStartAt
        ? toIsoStringOrNull(data.salesStartAt)
        : null;
      const salesEndIso = data.salesEndAt
        ? toIsoStringOrNull(data.salesEndAt)
        : null;
      if (data.salesStartAt && !salesStartIso) {
        setError("Sales start is not a valid date.");
        return;
      }
      if (data.salesEndAt && !salesEndIso) {
        setError("Sales end is not a valid date.");
        return;
      }
      if (salesEndIso && new Date(salesEndIso) > eventEnd) {
        setError("Sales end must be on or before event end");
        return;
      }
      if (
        salesStartIso &&
        salesEndIso &&
        new Date(salesEndIso) <= new Date(salesStartIso)
      ) {
        setError("Sales end must be after sales start");
        return;
      }

      const allowInstallments = Boolean(data.allowInstallments);
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || undefined,
        priceCents: Math.round(data.priceCents * 100),
        quantity: data.quantity,
        maxPerOrder: data.maxPerOrder || undefined,
        salesStartAt: salesStartIso ?? undefined,
        salesEndAt: salesEndIso ?? undefined,
        allowInstallments,
      };

      if (canPriceEditPublished && editingId !== "new") {
        await apiClient.patch(`/ticket-types/${editingId}`, {
          priceCents: Math.round(data.priceCents * 100),
        });
        setSuccess("Ticket price updated");
      } else {
        if (
          allowInstallments &&
          data.installmentConfig &&
          data.installmentConfig.splits
        ) {
          payload.installmentConfig = {
            mode: "PERCENT_SPLITS" as const,
            splits: data.installmentConfig.splits
              .filter(
                (s) =>
                  s.seq && s.pct !== undefined && s.dueAfterDays !== undefined,
              )
              .map((s) => ({
                seq: Number(s.seq),
                pct: Number(s.pct),
                dueAfterDays: Number(s.dueAfterDays),
              })),
            minDepositPct: data.installmentConfig.minDepositPct
              ? Number(data.installmentConfig.minDepositPct)
              : undefined,
            gracePeriodDays: data.installmentConfig.gracePeriodDays
              ? Number(data.installmentConfig.gracePeriodDays)
              : undefined,
            autoCancelOnDefault:
              data.installmentConfig.autoCancelOnDefault || false,
          };
        }
        if (editingId === "new") {
          await apiClient.post(`/events/${event.id}/ticket-types`, payload);
          setSuccess("Ticket tier created");
        } else {
          await apiClient.patch(`/ticket-types/${editingId}`, payload);
          setSuccess("Ticket tier updated");
        }
      }

      await refresh();
      setEditingId(null);
      setPresetDefaults(null);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      const message = extractApiMessage(err);
      if (status === 403)
        setError("You do not have permission to manage tiers for this event");
      else if (status === 409)
        setError(
          message ||
            "A tier with that name already exists. Pick a different name.",
        );
      else if (status === 400)
        setError(message || "Validation failed. Please check your input.");
      else setError(message || "Failed to save ticket tier");
      if (process.env.NODE_ENV !== "production") {
        console.debug("[TicketTierForm] save failed", { status, message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const editingTier = editingId
    ? ticketTypes.find((t) => t.id === editingId)
    : null;

  const showList = !loading && editingId === null;
  const isEmpty = ticketTypes.length === 0;
  const currency = ticketTypes[0]?.currency ?? "KES";

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-panel)] border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-[var(--radius-panel)] border border-emerald-600/35 bg-emerald-500/10 p-3 text-sm text-emerald-100"
        >
          {success}
        </div>
      )}

      <SummaryStrip
        ticketTiers={ticketTypes.length}
        totalInventory={summary.total}
        sold={summary.sold}
        active={summary.active}
        revenuePotential={summary.revenue}
        currency={currency}
        canAdd={canEditAnyField && editingId === null}
        onAdd={() => startCreate()}
      />

      {editingId && (
        <TicketTierForm
          tier={editingId === "new" ? null : editingTier || null}
          presetDefaults={editingId === "new" ? presetDefaults : null}
          eventStartAt={event.startAt}
          eventEndAt={event.endAt}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          isEditable={canSubmitEdits}
          isPriceOnlyMode={canPriceEditPublished && editingId !== "new"}
          externalError={error}
        />
      )}

      {loading && (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-8 text-center text-sm text-muted">
          Loading ticket tiers…
        </div>
      )}

      {showList && isEmpty && (
        <EmptyState
          presets={TIER_PRESETS}
          onPick={(p) => startCreate(p.defaults)}
          onCustom={() => startCreate()}
          canAdd={canEditAnyField}
        />
      )}

      {showList && !isEmpty && (
        <ul className="space-y-3">
          {ticketTypes.map((tier) => (
            <li key={tier.id}>
              <TicketTierRow
                tier={tier}
                eventStatus={event.status}
                canEdit={canSubmitEdits}
                canEditAllFields={canEditAnyField}
                onEdit={() => handleEdit(tier.id)}
                onDuplicate={() => handleDuplicate(tier)}
                onDelete={() => handleDelete(tier.id)}
                onQuantityChange={(qty) => handleQuantityChange(tier.id, qty)}
              />
            </li>
          ))}
        </ul>
      )}

      {!canEditAnyField && !isPublished && (
        <p className="text-sm text-muted">
          Ticket tiers cannot be edited in the current event status.
        </p>
      )}

      {isPublished && (
        <div className="rounded-[var(--radius-panel)] border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <strong>Published.</strong> You can still tune prices for future
          purchases, but tier structure (name, quantity, limits, dates) is
          locked.
        </div>
      )}
    </div>
  );
}

interface SummaryStripProps {
  ticketTiers: number;
  totalInventory: number;
  sold: number;
  active: number;
  revenuePotential: number;
  currency: string;
  canAdd: boolean;
  onAdd: () => void;
}

function SummaryStrip({
  ticketTiers,
  totalInventory,
  sold,
  active,
  revenuePotential,
  currency,
  canAdd,
  onAdd,
}: SummaryStripProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border bg-surface/70 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <SummaryStat label="Tiers" value={String(ticketTiers)} />
        <SummaryStat
          label="On sale"
          value={String(active)}
          accent={active > 0 ? "text-emerald-200" : undefined}
        />
        <SummaryStat
          label="Sold / total"
          value={`${sold.toLocaleString()} / ${totalInventory.toLocaleString()}`}
        />
        <SummaryStat
          label="Max revenue"
          value={formatPrice(revenuePotential, currency)}
        />
      </div>
      {canAdd && (
        <Button
          type="button"
          onClick={onAdd}
          className="w-auto shrink-0 self-start sm:self-center"
        >
          Add ticket tier
        </Button>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-base font-semibold tracking-tight text-foreground ${accent ?? ""}`}
      >
        {value}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  presets: TierPreset[];
  onPick: (preset: TierPreset) => void;
  onCustom: () => void;
  canAdd: boolean;
}

function EmptyState({ presets, onPick, onCustom, canAdd }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-white/15 bg-surface/50 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
          Start with a tier template
        </h3>
        <p className="text-sm text-muted">
          {canAdd
            ? "Pick a preset to populate sensible defaults, or build a custom tier."
            : "Tiers will appear here once the event re-enters draft."}
        </p>
      </div>

      {canAdd && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPick(preset)}
                className="group flex flex-col items-start gap-1 rounded-[var(--radius-panel)] border border-border bg-surface/80 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-surface focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {preset.label}
                </span>
                <span className="text-xs text-muted">{preset.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCustom}
            className="mt-4 text-sm font-semibold text-primary hover:underline"
          >
            Or build a custom tier from scratch →
          </button>
        </>
      )}
    </div>
  );
}

interface TicketTierRowProps {
  tier: TicketType;
  eventStatus: string;
  canEdit: boolean;
  canEditAllFields: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onQuantityChange: (qty: number) => void;
}

function TicketTierRow({
  tier,
  eventStatus,
  canEdit,
  canEditAllFields,
  onEdit,
  onDuplicate,
  onDelete,
  onQuantityChange,
}: TicketTierRowProps) {
  const status = tierStatus(tier, eventStatus);
  const sold = tier.quantitySold;
  const total = tier.quantityTotal;
  const available = Math.max(0, total - sold);
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const window = formatRelativeWindow(tier.salesStart, tier.salesEnd);

  return (
    <article className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:border-white/15">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold tracking-tight text-foreground">
              {tier.name}
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusChip(status)}`}
            >
              {statusLabel(status)}
            </span>
            {tier.allowInstallments && (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-foreground/85">
                Installments
              </span>
            )}
          </div>
          {tier.description && (
            <p className="mt-1 text-sm text-muted">{tier.description}</p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <RowStat label="Price" value={formatPrice(tier.priceCents, tier.currency)} />
            <RowStat
              label="Available"
              value={`${available.toLocaleString()} / ${total.toLocaleString()}`}
            />
            {tier.maxPerOrder ? (
              <RowStat label="Max / order" value={String(tier.maxPerOrder)} />
            ) : null}
            {window ? <RowStat label="Sales window" value={window} /> : null}
          </dl>

          <div className="mt-4">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Sold percentage"
            >
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              {sold.toLocaleString()} sold ({pct}%)
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end lg:text-right">
          {canEditAllFields ? (
            <QuantityStepper
              value={total}
              floor={sold}
              onChange={onQuantityChange}
            />
          ) : (
            <div className="text-xs text-muted">
              Inventory: <span className="text-foreground">{total}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                onClick={onEdit}
                className="w-auto px-3 py-1.5 text-xs"
              >
                Edit
              </Button>
            )}
            {canEditAllFields && (
              <Button
                type="button"
                variant="secondary"
                onClick={onDuplicate}
                className="w-auto px-3 py-1.5 text-xs"
              >
                Duplicate
              </Button>
            )}
            {canEditAllFields && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-[var(--radius-button)] border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function RowStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

interface QuantityStepperProps {
  value: number;
  floor: number;
  onChange: (next: number) => void;
}

function QuantityStepper({ value, floor, onChange }: QuantityStepperProps) {
  const step = (delta: number) => {
    const next = Math.max(floor, value + delta);
    if (next !== value) onChange(next);
  };
  const handleInput = (raw: string) => {
    if (raw === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.max(floor, Math.round(parsed)));
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-[var(--radius-button)] border border-border bg-white/[0.04] p-1">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= floor}
        className="grid h-8 w-8 place-items-center rounded-md text-base text-foreground/85 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Decrease inventory"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={floor}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        className="h-8 w-16 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground focus:outline-none"
        aria-label="Inventory total"
      />
      <button
        type="button"
        onClick={() => step(+1)}
        className="grid h-8 w-8 place-items-center rounded-md text-base text-foreground/85 transition hover:bg-white/[0.06]"
        aria-label="Increase inventory"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => step(+10)}
        className="ml-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-wide text-muted transition hover:bg-white/[0.06] hover:text-foreground"
        aria-label="Increase inventory by 10"
      >
        +10
      </button>
    </div>
  );
}

interface TicketTierFormProps {
  tier: TicketType | null;
  presetDefaults?: Partial<TicketTierInput> | null;
  eventStartAt: string;
  eventEndAt: string;
  onSubmit: (data: TicketTierInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditable: boolean;
  isPriceOnlyMode: boolean;
  /** Last error from the parent's submit attempt — rendered inside the form so it can't scroll off-screen. */
  externalError?: string | null;
}

function TicketTierForm({
  tier,
  presetDefaults,
  eventEndAt,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditable,
  isPriceOnlyMode,
  externalError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eventStartAt: _eventStartAt,
}: TicketTierFormProps) {
  const [validationHint, setValidationHint] = useState<string | null>(null);
  const canEditPriceField = isEditable;
  const canEditAllFields = isEditable && !isPriceOnlyMode;
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    control,
    setValue,
  } = useForm<TicketTierInput>({
    resolver: ticketTierResolver,
    mode: "onChange",
    defaultValues: {
      name: tier?.name || presetDefaults?.name || "",
      description: tier?.description || presetDefaults?.description || "",
      priceCents:
        tier != null
          ? tier.priceCents / 100
          : presetDefaults?.priceCents !== undefined
            ? Number(presetDefaults.priceCents) / 100
            : 0,
      quantity: tier?.quantityTotal ?? presetDefaults?.quantity ?? 100,
      maxPerOrder: tier?.maxPerOrder ?? presetDefaults?.maxPerOrder,
      salesStartAt: tier?.salesStart
        ? new Date(tier.salesStart).toISOString().slice(0, 16)
        : (presetDefaults?.salesStartAt ?? ""),
      salesEndAt: tier?.salesEnd
        ? new Date(tier.salesEnd).toISOString().slice(0, 16)
        : (presetDefaults?.salesEndAt ?? ""),
      allowInstallments:
        tier?.allowInstallments ?? presetDefaults?.allowInstallments ?? false,
      installmentConfig: tier?.installmentConfig
        ? {
            mode: "PERCENT_SPLITS" as const,
            splits: tier.installmentConfig.splits || [],
            minDepositPct: tier.installmentConfig.minDepositPct,
            gracePeriodDays: tier.installmentConfig.gracePeriodDays,
            autoCancelOnDefault: tier.installmentConfig.autoCancelOnDefault,
          }
        : (presetDefaults?.installmentConfig ?? undefined),
    },
  });

  const allowInstallments = watch("allowInstallments");
  const installmentConfig = watch("installmentConfig");
  const splits = installmentConfig?.splits || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: "installmentConfig.splits",
  });

  useEffect(() => {
    if (allowInstallments && fields.length === 0) {
      const currentConfig = watch("installmentConfig");
      if (!currentConfig) {
        setValue(
          "installmentConfig",
          {
            mode: "PERCENT_SPLITS",
            splits: [],
            minDepositPct: undefined,
            gracePeriodDays: undefined,
            autoCancelOnDefault: false,
          },
          { shouldValidate: false },
        );
      }
      append({ seq: 1, pct: 50, dueAfterDays: 0 });
      append({ seq: 2, pct: 50, dueAfterDays: 30 });
    } else if (!allowInstallments && installmentConfig) {
      setValue("installmentConfig", undefined, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowInstallments, fields.length]);

  const totalPct = splits.reduce((sum, split) => sum + (split.pct || 0), 0);

  const onFormSubmit = handleSubmit(
    (data) => {
      setValidationHint(null);
      return onSubmit(data);
    },
    (errs) => {
      const paths = collectFieldErrorPaths(errs);
      const count = paths.length;
      setValidationHint(
        count === 0
          ? "Please review the form before saving."
          : `Fix ${count} highlighted field${count === 1 ? "" : "s"} before saving.`,
      );
      // Use console.debug so Next.js 16's dev overlay doesn't treat normal
      // form validation as a Console Error.
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          "[TicketTierForm] validation blocked submit:",
          paths.length > 0 ? paths : "(no field paths)",
        );
      }
      const firstPath = paths[0];
      if (firstPath) {
        const element = document.querySelector(`[name="${firstPath}"]`);
        if (element instanceof HTMLElement) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus({ preventScroll: true });
        }
      }
    },
  );

  return (
    <form
      onSubmit={onFormSubmit}
      className="space-y-5 rounded-[var(--radius-panel)] border border-border bg-surface/80 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {tier
            ? isPriceOnlyMode
              ? "Edit price"
              : "Edit ticket tier"
            : "New ticket tier"}
        </p>
        <h4 className="font-display text-xl font-semibold tracking-tight text-foreground">
          {tier?.name || "Configure pricing, inventory, and sales window"}
        </h4>
      </div>

      <Input
        label="Name"
        type="text"
        placeholder="General Admission"
        {...register("name")}
        error={errors.name?.message}
        disabled={!canEditAllFields}
      />

      <Textarea
        label="Description"
        rows={3}
        placeholder="What buyers get with this tier."
        {...register("description")}
        error={errors.description?.message}
        disabled={!canEditAllFields}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="Price"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("priceCents", { valueAsNumber: true })}
            error={errors.priceCents?.message}
            disabled={!canEditPriceField}
          />
          <p className="mt-1 text-xs text-muted">
            In KES (e.g. 1500 for 1,500 KES). Set 0 for a free tier.
          </p>
        </div>
        <Input
          label="Quantity"
          type="number"
          min="0"
          placeholder="100"
          {...register("quantity", { valueAsNumber: true })}
          error={errors.quantity?.message}
          disabled={!canEditAllFields}
        />
      </div>

      <Input
        label="Max per order"
        type="number"
        min="1"
        placeholder="Optional limit per buyer"
        {...register("maxPerOrder", {
          valueAsNumber: true,
          setValueAs: (v) => (v === "" ? undefined : Number(v)),
        })}
        error={errors.maxPerOrder?.message}
        disabled={!canEditAllFields}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Sales start"
          type="datetime-local"
          max={new Date(eventEndAt).toISOString().slice(0, 16)}
          {...register("salesStartAt")}
          error={errors.salesStartAt?.message}
          disabled={!canEditAllFields}
        />
        <Input
          label="Sales end"
          type="datetime-local"
          max={new Date(eventEndAt).toISOString().slice(0, 16)}
          {...register("salesEndAt")}
          error={errors.salesEndAt?.message}
          disabled={!canEditAllFields}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        Sales can begin any time. They must close on or before the event ends.
      </p>

      <div className="space-y-4 border-t border-border pt-5">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            id="allowInstallments"
            {...register("allowInstallments")}
            disabled={!canEditAllFields}
            className="h-4 w-4 accent-[color:var(--color-primary)]"
          />
          Allow payment in installments
        </label>
        {errors.allowInstallments && (
          <p className="text-sm text-primary">{errors.allowInstallments.message}</p>
        )}

        {allowInstallments && (
          <div className="space-y-4 rounded-[var(--radius-panel)] border border-border bg-wash/40 p-4">
            <input
              type="hidden"
              {...register("installmentConfig.mode")}
              value="PERCENT_SPLITS"
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Payment splits
              </p>
              <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="p-2 text-left font-semibold">#</th>
                      <th className="p-2 text-left font-semibold">%</th>
                      <th className="p-2 text-left font-semibold">Due after (days)</th>
                      <th className="p-2 text-right font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const splitErrors =
                        errors.installmentConfig?.splits?.[index];
                      return (
                        <tr key={field.id} className="border-t border-border">
                          <td className="p-2">
                            <input
                              type="number"
                              {...register(
                                `installmentConfig.splits.${index}.seq` as const,
                                { valueAsNumber: true, required: true },
                              )}
                              disabled={!isEditable}
                              className="h-9 w-16 rounded-md border border-border bg-white/[0.05] px-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                              min="1"
                            />
                            {splitErrors?.seq && (
                              <p className="mt-1 text-xs text-primary">
                                {splitErrors.seq.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              {...register(
                                `installmentConfig.splits.${index}.pct` as const,
                                { valueAsNumber: true, required: true },
                              )}
                              disabled={!isEditable}
                              className="h-9 w-20 rounded-md border border-border bg-white/[0.05] px-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                              min="0"
                              max="100"
                            />
                            {splitErrors?.pct && (
                              <p className="mt-1 text-xs text-primary">
                                {splitErrors.pct.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              {...register(
                                `installmentConfig.splits.${index}.dueAfterDays` as const,
                                { valueAsNumber: true, required: true },
                              )}
                              disabled={!isEditable}
                              className="h-9 w-24 rounded-md border border-border bg-white/[0.05] px-2 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                              min="0"
                            />
                            {splitErrors?.dueAfterDays && (
                              <p className="mt-1 text-xs text-primary">
                                {splitErrors.dueAfterDays.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {canEditAllFields && fields.length > 2 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="text-xs font-semibold text-red-300 hover:text-red-200"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errors.installmentConfig && (
                <div className="mt-2 space-y-1">
                  {errors.installmentConfig.splits && (
                    <p className="text-sm text-primary">
                      {typeof errors.installmentConfig.splits === "string"
                        ? errors.installmentConfig.splits
                        : errors.installmentConfig.splits.message ||
                          errors.installmentConfig.splits.root?.message ||
                          "Please fix the errors in the payment splits"}
                    </p>
                  )}
                  {errors.installmentConfig.message && (
                    <p className="text-sm text-primary">
                      {errors.installmentConfig.message}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-muted">
                  Total: <span className="font-semibold text-foreground">{totalPct.toFixed(2)}%</span>
                  {Math.abs(totalPct - 100) > 0.01 && (
                    <span className="ml-2 text-primary">(must equal 100%)</span>
                  )}
                </p>
                {canEditAllFields && (
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        seq: fields.length + 1,
                        pct: 0,
                        dueAfterDays: 0,
                      })
                    }
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    + Add split
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Min deposit %"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Optional"
                {...register("installmentConfig.minDepositPct", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                error={errors.installmentConfig?.minDepositPct?.message}
                disabled={!canEditAllFields}
              />
              <Input
                label="Grace period (days)"
                type="number"
                min="0"
                placeholder="Optional"
                {...register("installmentConfig.gracePeriodDays", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                error={errors.installmentConfig?.gracePeriodDays?.message}
                disabled={!canEditAllFields}
              />
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  id="autoCancelOnDefault"
                  {...register("installmentConfig.autoCancelOnDefault")}
                  disabled={!canEditAllFields}
                  className="h-4 w-4 accent-[color:var(--color-primary)]"
                />
                Auto-cancel on default
              </label>
            </div>
          </div>
        )}
      </div>

      {externalError && (
        <div
          role="alert"
          className="rounded-[var(--radius-panel)] border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
        >
          {externalError}
        </div>
      )}
      {validationHint && !externalError && (
        <div
          role="alert"
          className="rounded-[var(--radius-panel)] border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
        >
          {validationHint}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="submit"
          disabled={!isEditable || isSubmitting}
          className="w-auto"
          data-testid={
            tier ? "update-ticket-tier-button" : "create-ticket-tier-button"
          }
        >
          {isSubmitting
            ? "Saving…"
            : tier
              ? isPriceOnlyMode
                ? "Update price"
                : "Update tier"
              : "Create tier"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-auto"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
