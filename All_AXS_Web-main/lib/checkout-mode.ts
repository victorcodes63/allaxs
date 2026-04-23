/** When true, checkout and tickets use the Nest API (Neon-backed orders). */
export function isApiCheckoutEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_API_CHECKOUT === "true";
}
