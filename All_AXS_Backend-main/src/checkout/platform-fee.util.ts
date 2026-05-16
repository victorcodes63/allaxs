/**
 * Platform fee on the ticket subtotal (buyer-paid order total).
 * Organizer-facing net = subtotal − fee.
 */
export function computePlatformFeeCents(
  subtotalCents: number,
  getEnv: (key: string) => string | undefined,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
    return 0;
  }

  const bps = Math.max(0, Math.floor(Number.parseInt(String(getEnv('PLATFORM_FEE_BPS') ?? '0'), 10) || 0));
  const fixed = Math.max(
    0,
    Math.floor(Number.parseInt(String(getEnv('PLATFORM_FEE_FIXED_CENTS') ?? '0'), 10) || 0),
  );
  const maxRaw = getEnv('PLATFORM_FEE_MAX_CENTS');
  const maxParsed = Number.parseInt(String(maxRaw ?? ''), 10);
  const maxCents =
    maxRaw !== undefined && maxRaw !== '' && Number.isFinite(maxParsed)
      ? Math.max(0, maxParsed)
      : null;

  const percentPart = Math.floor((subtotalCents * bps) / 10000);
  let fee = fixed + percentPart;
  if (maxCents !== null) {
    fee = Math.min(fee, maxCents);
  }
  fee = Math.min(fee, subtotalCents);
  return fee;
}
