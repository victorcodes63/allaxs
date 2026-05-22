/**
 * Platform default when order/event/tier currency is absent.
 * Kenya-first product — use only as a last-resort fallback.
 */
export const PLATFORM_DEFAULT_CURRENCY = 'KES';

const ISO4217 = /^[A-Z]{3}$/;

export function isValidCurrencyCode(code: string): boolean {
  return ISO4217.test(code.trim().toUpperCase());
}

export function normalizeCurrencyCode(
  code: string | null | undefined,
  fallback: string = PLATFORM_DEFAULT_CURRENCY,
): string {
  const trimmed = (code ?? '').trim().toUpperCase();
  if (isValidCurrencyCode(trimmed)) return trimmed;
  const fb = fallback.trim().toUpperCase();
  return isValidCurrencyCode(fb) ? fb : PLATFORM_DEFAULT_CURRENCY;
}

export function resolveCurrencyFromTicketTypes(
  ticketTypes: ReadonlyArray<{ currency?: string | null }> | null | undefined,
  fallback: string = PLATFORM_DEFAULT_CURRENCY,
): string {
  const fromTier = ticketTypes?.find((t) => t.currency?.trim())?.currency;
  return normalizeCurrencyCode(fromTier, fallback);
}
