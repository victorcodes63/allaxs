"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  createCoupon,
  updateCoupon,
  type Coupon,
  type CouponKind,
  type CreateCouponPayload,
} from "@/lib/coupons-api";

interface CouponFormDialogProps {
  open: boolean;
  /** When provided, the dialog is in edit mode. Omit for create mode. */
  coupon?: Coupon | null;
  eventId: string;
  /** Currency the event sells in. Used as the default for new coupons. */
  defaultCurrency?: string;
  onClose: () => void;
  onSaved: (coupon: Coupon) => void;
}

interface FormState {
  code: string;
  kind: CouponKind;
  valueMajor: string;
  percentOff: string;
  startAt: string;
  endAt: string;
  usageLimit: string;
  perUserLimit: string;
  minOrderMajor: string;
  currency: string;
  active: boolean;
}

function toFormState(
  coupon: Coupon | null | undefined,
  defaultCurrency: string,
): FormState {
  if (!coupon) {
    return {
      code: "",
      kind: "PERCENT",
      valueMajor: "",
      percentOff: "10",
      startAt: "",
      endAt: "",
      usageLimit: "",
      perUserLimit: "1",
      minOrderMajor: "",
      currency: defaultCurrency,
      active: true,
    };
  }
  return {
    code: coupon.code,
    kind: coupon.kind,
    valueMajor:
      coupon.valueCents !== undefined && coupon.valueCents !== null
        ? (coupon.valueCents / 100).toString()
        : "",
    percentOff:
      coupon.percentOff !== undefined && coupon.percentOff !== null
        ? coupon.percentOff.toString()
        : "",
    startAt: toLocalInput(coupon.startAt),
    endAt: toLocalInput(coupon.endAt),
    usageLimit:
      coupon.usageLimit !== undefined && coupon.usageLimit !== null
        ? coupon.usageLimit.toString()
        : "",
    perUserLimit:
      coupon.perUserLimit !== undefined && coupon.perUserLimit !== null
        ? coupon.perUserLimit.toString()
        : "",
    minOrderMajor:
      coupon.minOrderCents !== undefined && coupon.minOrderCents !== null
        ? (coupon.minOrderCents / 100).toString()
        : "",
    currency: coupon.currency ?? defaultCurrency,
    active: coupon.active,
  };
}

/**
 * Convert ISO timestamp → `YYYY-MM-DDTHH:mm` (the value shape that
 * `<input type="datetime-local">` accepts). Returns "" for falsy input.
 */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parsePositiveIntOrUndefined(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) return undefined;
  return n;
}

function parseNonNegativeIntOrUndefined(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined;
  return n;
}

export function CouponFormDialog({
  open,
  coupon,
  eventId,
  defaultCurrency = "KES",
  onClose,
  onSaved,
}: CouponFormDialogProps) {
  const isEdit = !!coupon;
  const [form, setForm] = useState<FormState>(() =>
    toFormState(coupon, defaultCurrency),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(coupon, defaultCurrency));
      setError(null);
    }
  }, [open, coupon, defaultCurrency]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError(null);

    const code = form.code.trim();
    if (code.length < 2 || code.length > 64) {
      setError("Code must be 2-64 characters.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/u.test(code)) {
      setError("Code may contain only letters, numbers, dashes, and underscores.");
      return;
    }

    if (form.kind === "FIXED") {
      const major = Number(form.valueMajor);
      if (
        !Number.isFinite(major) ||
        major <= 0 ||
        Math.round(major * 100) <= 0
      ) {
        setError("Fixed discount value must be greater than zero.");
        return;
      }
    } else {
      const pct = Number(form.percentOff);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100 || !Number.isInteger(pct)) {
        setError("Percent off must be an integer between 1 and 100.");
        return;
      }
    }

    if (form.startAt && form.endAt) {
      if (new Date(form.endAt).getTime() <= new Date(form.startAt).getTime()) {
        setError("End must be after start.");
        return;
      }
    }

    const currency = form.currency.trim().toUpperCase();
    if (currency && currency.length !== 3) {
      setError("Currency must be a 3-letter ISO code.");
      return;
    }

    const payload: CreateCouponPayload = {
      code: code.toUpperCase(),
      kind: form.kind,
      valueCents:
        form.kind === "FIXED"
          ? Math.round(Number(form.valueMajor) * 100)
          : undefined,
      percentOff:
        form.kind === "PERCENT" ? Number(form.percentOff) : undefined,
      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
      usageLimit: parsePositiveIntOrUndefined(form.usageLimit),
      perUserLimit: parsePositiveIntOrUndefined(form.perUserLimit),
      minOrderCents:
        form.minOrderMajor.trim() === ""
          ? undefined
          : Math.round(Number(form.minOrderMajor) * 100),
      currency: currency || undefined,
      active: form.active,
    };

    // minOrder validation
    if (
      payload.minOrderCents !== undefined &&
      (!Number.isFinite(payload.minOrderCents) || payload.minOrderCents < 0)
    ) {
      setError("Minimum order must be a non-negative number.");
      return;
    }
    if (form.usageLimit.trim() && payload.usageLimit === undefined) {
      setError("Total usage limit must be a positive integer.");
      return;
    }
    if (form.perUserLimit.trim() && payload.perUserLimit === undefined) {
      setError("Per-user limit must be a positive integer.");
      return;
    }

    setSubmitting(true);
    try {
      const saved =
        isEdit && coupon
          ? await updateCoupon(coupon.id, payload)
          : await createCoupon(eventId, payload);
      onSaved(saved);
    } catch (err) {
      const fallback = "Failed to save coupon. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (err.response?.data as { message?: string | string[] } | undefined)
          ?.message;
        const messageStr = Array.isArray(apiMessage)
          ? apiMessage.join(" • ")
          : apiMessage;
        if (status === 400) {
          setError(messageStr ?? "Some fields are invalid. Please review and try again.");
        } else if (status === 403) {
          setError("You do not have permission to manage coupons for this event.");
        } else if (status === 404) {
          setError("Event or coupon not found.");
        } else if (status === 409) {
          setError(messageStr ?? "That code is already in use. Try a different one.");
        } else {
          setError(messageStr ?? err.message ?? fallback);
        }
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={isEdit ? "Edit coupon" : "Create coupon"}
      ariaLabel={isEdit ? "Edit coupon dialog" : "Create coupon dialog"}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-auto"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="w-auto">
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create coupon"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
          >
            {error}
          </div>
        )}

        <Input
          label="Code"
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="e.g. EARLY2026"
          maxLength={64}
          autoFocus={!isEdit}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Discount</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Discount kind">
            {(["PERCENT", "FIXED"] as const).map((k) => {
              const selected = form.kind === k;
              return (
                <button
                  type="button"
                  key={k}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set("kind", k)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-foreground hover:border-primary/30"
                  }`}
                >
                  {k === "PERCENT" ? "Percent off" : "Fixed amount"}
                </button>
              );
            })}
          </div>

          {form.kind === "PERCENT" ? (
            <Input
              label="Percent off"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              value={form.percentOff}
              onChange={(e) => set("percentOff", e.target.value)}
              placeholder="e.g. 15"
            />
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <Input
                label={`Value (${form.currency || "KES"})`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={form.valueMajor}
                onChange={(e) => set("valueMajor", e.target.value)}
                placeholder="e.g. 250"
              />
              <Input
                label="Currency"
                value={form.currency}
                onChange={(e) =>
                  set("currency", e.target.value.toUpperCase().slice(0, 3))
                }
                maxLength={3}
                placeholder="KES"
                className="w-20"
              />
            </div>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Start"
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => set("startAt", e.target.value)}
          />
          <Input
            label="End"
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => set("endAt", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Total usage cap"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.usageLimit}
            onChange={(e) => set("usageLimit", e.target.value)}
            placeholder="Unlimited"
          />
          <Input
            label="Per buyer cap"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.perUserLimit}
            onChange={(e) => set("perUserLimit", e.target.value)}
            placeholder="Unlimited"
          />
        </div>

        <Input
          label={`Minimum order (${form.currency || "KES"})`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={form.minOrderMajor}
          onChange={(e) => set("minOrderMajor", e.target.value)}
          placeholder="No minimum"
        />

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Active (buyers can apply this code at checkout)
        </label>
      </div>
    </Dialog>
  );
}
