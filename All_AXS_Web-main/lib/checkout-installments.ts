export type InstallmentConfig = {
  mode: "PERCENT_SPLITS";
  splits: Array<{ seq: number; pct: number; dueAfterDays: number }>;
  minDepositPct?: number;
  gracePeriodDays?: number;
  autoCancelOnDefault?: boolean;
};

export type CheckoutTierWithInstallments = {
  id: string;
  allowInstallments?: boolean;
  installmentConfig?: InstallmentConfig | null;
};

/** Split `totalCents` per backend PaymentPlansService (remainder on last). */
export function computeInstallmentAmountsCents(
  totalCents: number,
  splits: InstallmentConfig["splits"],
): number[] {
  const sorted = [...splits].sort((a, b) => a.seq - b.seq);
  let remaining = totalCents;
  const amounts: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const isLast = i === sorted.length - 1;
    if (isLast) {
      amounts.push(remaining);
    } else {
      const amount = Math.round((totalCents * sorted[i].pct) / 100);
      amounts.push(amount);
      remaining -= amount;
    }
  }
  return amounts;
}

export function firstInstallmentCents(
  totalCents: number,
  config: InstallmentConfig,
): number {
  const amounts = computeInstallmentAmountsCents(totalCents, config.splits);
  return amounts[0] ?? totalCents;
}

/** Installments only when a single tier is in the cart and it allows plans. */
export function canOfferInstallments(
  lineItems: { ticketTypeId: string; quantity: number }[],
  tiers: CheckoutTierWithInstallments[],
): boolean {
  if (lineItems.length !== 1) return false;
  const line = lineItems[0];
  const tier = tiers.find((t) => t.id === line.ticketTypeId);
  return Boolean(
    tier?.allowInstallments &&
      tier.installmentConfig?.splits &&
      tier.installmentConfig.splits.length >= 2,
  );
}

export function installmentTierForCart(
  lineItems: { ticketTypeId: string }[],
  tiers: CheckoutTierWithInstallments[],
): CheckoutTierWithInstallments | null {
  if (lineItems.length !== 1) return null;
  const tier = tiers.find((t) => t.id === lineItems[0].ticketTypeId);
  if (!tier?.allowInstallments || !tier.installmentConfig) return null;
  return tier;
}
