/**
 * Whether public /events and /e/[slug] use local demo fixtures vs the Nest API.
 *
 * Demo fixtures use ids like `demo-evt-01` — incompatible with Paystack checkout,
 * which requires UUID event and ticket type ids from the database.
 */
export function isDemoPublicEventsMode(): boolean {
  // Never serve fixture catalog on Vercel Production, even if env is mis-set.
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.NEXT_PUBLIC_USE_API_CHECKOUT === "true") {
    return false;
  }
  const flag = process.env.NEXT_PUBLIC_USE_DEMO_EVENTS;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
