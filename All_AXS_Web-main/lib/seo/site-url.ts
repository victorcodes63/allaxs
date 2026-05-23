/**
 * Canonical public origin used by metadata helpers, sitemaps, OG URLs, and
 * structured data. Mirrors the resolution rules used elsewhere on the site
 * (see {@link ../site-url.ts}) but exposed as a constant for ergonomic
 * `metadataBase` and `new URL(...)` usage.
 */
function resolveSiteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export const SITE_BASE_URL: string = resolveSiteBaseUrl();
