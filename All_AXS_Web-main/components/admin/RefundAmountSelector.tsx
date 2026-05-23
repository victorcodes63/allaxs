"use client";

import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  calculatePolicyRefundCents,
  refundModeLabel,
  resolveRefundPreview,
  STANDARD_REFUND_PERCENT,
  type RefundMode,
} from "@/lib/refunds/policy";

export interface RefundAmountSelection {
  refundMode: RefundMode;
  customAmountCents?: number;
}

interface RefundAmountSelectorProps {
  orderAmountCents: number;
  currency: string;
  value: RefundAmountSelection;
  onChange: (next: RefundAmountSelection) => void;
  /** When true, hide policy option (e.g. bulk event cancellation). */
  fullOnly?: boolean;
}

export function RefundAmountSelector({
  orderAmountCents,
  currency,
  value,
  onChange,
  fullOnly = false,
}: RefundAmountSelectorProps) {
  const preview = resolveRefundPreview(
    orderAmountCents,
    value.refundMode,
    value.customAmountCents,
  );

  const policyCents = calculatePolicyRefundCents(orderAmountCents);
  const customMajor =
    value.customAmountCents !== undefined
      ? (value.customAmountCents / 100).toFixed(2)
      : "";

  const modes: RefundMode[] = fullOnly
    ? ["FULL"]
    : ["POLICY", "FULL", "CUSTOM"];

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Refund amount
        </legend>
        {modes.map((mode) => {
          const id = `refund-mode-${mode}`;
          const checked = value.refundMode === mode;
          const modePreview =
            mode === "POLICY"
              ? formatMoneyFromCents(policyCents, currency)
              : mode === "FULL"
                ? formatMoneyFromCents(orderAmountCents, currency)
                : null;

          return (
            <label
              key={mode}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-panel)] border px-3 py-2.5 text-sm transition-colors ${
                checked
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-surface/50 hover:border-primary/30"
              }`}
            >
              <input
                id={id}
                type="radio"
                name="refund-mode"
                className="mt-1"
                checked={checked}
                onChange={() => onChange({ ...value, refundMode: mode })}
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">
                  {refundModeLabel(mode)}
                </span>
                {mode === "POLICY" ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    Buyer receives {modePreview}. Platform retains{" "}
                    {STANDARD_REFUND_PERCENT}% fee per published policy.
                  </span>
                ) : null}
                {mode === "FULL" ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    Refund entire order total ({modePreview}). Use for cancelled
                    events or platform errors.
                  </span>
                ) : null}
                {mode === "CUSTOM" ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    Enter a specific amount (e.g. downgrade or goodwill).
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {value.refundMode === "CUSTOM" ? (
        <div>
          <label
            htmlFor="custom-refund-amount"
            className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted"
          >
            Custom refund ({currency})
          </label>
          <input
            id="custom-refund-amount"
            type="number"
            min={0.01}
            max={orderAmountCents / 100}
            step={0.01}
            value={customMajor}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value);
              onChange({
                ...value,
                customAmountCents: Number.isFinite(parsed)
                  ? Math.round(parsed * 100)
                  : undefined,
              });
            }}
            className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground"
            placeholder={(orderAmountCents / 100).toFixed(2)}
          />
        </div>
      ) : null}

      <div className="rounded-[var(--radius-panel)] border border-border/70 bg-background/40 px-3 py-2.5 text-xs text-muted">
        <p>
          Buyer will receive{" "}
          <strong className="text-foreground">
            {formatMoneyFromCents(
              Math.max(0, preview.refundAmountCents),
              currency,
            )}
          </strong>
          {preview.isPartialRefund ? (
            <>
              {" "}
              (retained{" "}
              {formatMoneyFromCents(preview.retainedCents, currency)} per policy/fees)
            </>
          ) : null}
          . Tickets are voided and tier inventory is restored regardless of amount.
        </p>
      </div>
    </div>
  );
}

/** Build API payload from UI selection. */
export function refundSelectionToPayload(selection: RefundAmountSelection): {
  refundMode: RefundMode;
  amountCents?: number;
} {
  if (selection.refundMode === "CUSTOM") {
    return {
      refundMode: "CUSTOM",
      amountCents: selection.customAmountCents,
    };
  }
  return { refundMode: selection.refundMode };
}
