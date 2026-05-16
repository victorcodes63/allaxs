/**
 * Canonical public site origin for ticket QR links, emails, and OG URLs.
 */
export function getPublicSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
