/**
 * Utility functions for handling event images
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const SITE_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

/**
 * Resolved banner for `next/image`: same-origin paths under `public/` (e.g. `/posters/...`)
 * stay relative so the optimizer treats them as local. Remote/API URLs stay absolute.
 */
export function getEventBannerUrl(bannerUrl: string | null | undefined): string {
  if (!bannerUrl) {
    return "/images/event-placeholder.jpg";
  }

  if (bannerUrl.startsWith("data:") || bannerUrl.startsWith("blob:")) {
    return bannerUrl;
  }

  if (bannerUrl.startsWith("http://") || bannerUrl.startsWith("https://")) {
    return bannerUrl;
  }

  const path = bannerUrl.startsWith("/") ? bannerUrl : `/${bannerUrl}`;

  if (path.startsWith("/static/") || path.startsWith("/uploads/")) {
    return `${API_BASE_URL}${path}`;
  }

  return path;
}

/**
 * Absolute URL for Open Graph, JSON-LD, and any crawler that requires a full URL.
 */
export function getEventBannerAbsoluteUrl(bannerUrl: string | null | undefined): string {
  const resolved = getEventBannerUrl(bannerUrl);
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  const base = SITE_BASE_URL.replace(/\/$/, "");
  return `${base}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

/**
 * Use with next/image `unoptimized` for sources that break Vercel/Next’s default optimizer.
 */
export function shouldUnoptimizeEventImage(url: string): boolean {
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    /^https?:\/\/images\.unsplash\.com\//.test(url) ||
    // Local Nest API (dev). next/image's remotePatterns + helmet's CORP are
    // both fragile here; skipping the optimiser lets the browser load the
    // poster directly from /static once the backend opts the route into
    // cross-origin embedding.
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
  );
}

/**
 * Get placeholder image URL
 */
export function getPlaceholderImageUrl(): string {
  return "/images/event-placeholder.jpg";
}

/**
 * Generate a deterministic placeholder image based on event title
 * Returns a data URL with a gradient and initials
 * Server-side safe (works in both server and client)
 */
export function generatePlaceholderImage(title: string): string {
  // Get initials from title
  const initials = title
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Generate a deterministic color based on title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const color = `hsl(${hue}, 70%, 50%)`;

  // Create SVG placeholder (URL-encoded for data URL)
  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${color};stop-opacity:1" /><stop offset="100%" style="stop-color:${color}dd;stop-opacity:1" /></linearGradient></defs><rect width="800" height="400" fill="url(#grad)"/><text x="50%" y="50%" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;

  // URL encode the SVG for data URL
  const encodedSvg = encodeURIComponent(svg);
  return `data:image/svg+xml;utf8,${encodedSvg}`;
}

