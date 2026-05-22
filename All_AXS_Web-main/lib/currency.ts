/**
 * Platform default when order/event/tier currency is absent from the API.
 * Kenya-first product — use only as a last-resort display fallback.
 */
export const PLATFORM_DEFAULT_CURRENCY = "KES" as const;

const ISO4217 = /^[A-Z]{3}$/;

export function isValidCurrencyCode(code: string): boolean {
  return ISO4217.test(code.trim().toUpperCase());
}

/** Normalise to uppercase ISO 4217 or fall back (default: platform default). */
export function normalizeCurrencyCode(
  code: string | null | undefined,
  fallback: string = PLATFORM_DEFAULT_CURRENCY,
): string {
  const trimmed = (code ?? "").trim().toUpperCase();
  if (isValidCurrencyCode(trimmed)) return trimmed;
  const fb = fallback.trim().toUpperCase();
  return isValidCurrencyCode(fb) ? fb : PLATFORM_DEFAULT_CURRENCY;
}

/** First non-empty currency on ticket tiers / line items. */
export function resolveCurrencyFromTiers(
  tiers: ReadonlyArray<{ currency?: string | null }> | null | undefined,
  fallback: string = PLATFORM_DEFAULT_CURRENCY,
): string {
  const fromTier = tiers?.find((t) => t.currency?.trim())?.currency;
  return normalizeCurrencyCode(fromTier, fallback);
}

type UnknownRecord = Record<string, unknown>;

function pickString(obj: UnknownRecord, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

/** Resolve currency from ticket DTOs (direct, nested order, or ticketType). */
export function resolveTicketApiCurrency(raw: UnknownRecord): string {
  const direct = pickString(raw, ["currency"]);
  if (direct) return normalizeCurrencyCode(direct);

  const order = raw.order ?? raw.order_details;
  if (order && typeof order === "object") {
    const fromOrder = pickString(order as UnknownRecord, ["currency"]);
    if (fromOrder) return normalizeCurrencyCode(fromOrder);
  }

  const ticketType = raw.ticketType ?? raw.ticket_type;
  if (ticketType && typeof ticketType === "object") {
    const fromTier = pickString(ticketType as UnknownRecord, ["currency"]);
    if (fromTier) return normalizeCurrencyCode(fromTier);
  }

  return PLATFORM_DEFAULT_CURRENCY;
}
