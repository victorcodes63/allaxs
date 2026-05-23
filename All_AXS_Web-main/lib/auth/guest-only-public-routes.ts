import { normalizeWebUserRoles, rolesIncludeAdmin } from "@/lib/auth/hub-routing";

/**
 * When `public=1` is present, signed-in users may view guest-only marketing
 * routes (used by auth-page footer links that should always open the public site).
 */
export const PUBLIC_BROWSE_QUERY = "public";
export const PUBLIC_BROWSE_COOKIE = "allaxs_public_browse";

export function isPublicBrowseIntent(
  search: string | URLSearchParams | null | undefined,
): boolean {
  if (!search) return false;
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(PUBLIC_BROWSE_QUERY) === "1";
}

type CookieReader = { get(name: string): { value: string } | undefined };

/** True when URL or the public-browse session cookie says to stay on marketing pages. */
export function isPublicBrowseActive(
  search: string | URLSearchParams | null | undefined,
  cookieReader?: CookieReader,
): boolean {
  if (isPublicBrowseIntent(search)) return true;
  return cookieReader?.get(PUBLIC_BROWSE_COOKIE)?.value === "1";
}

export function readPublicBrowseCookieFromDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${PUBLIC_BROWSE_COOKIE}=1`);
}

/** Append `public=1` so marketing links from auth pages skip hub redirects. */
export function withPublicBrowseIntent(path: string): string {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathAndQuery = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = pathAndQuery.indexOf("?");
  const pathname =
    queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
  const params = new URLSearchParams(
    queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : "",
  );
  params.set(PUBLIC_BROWSE_QUERY, "1");
  const qs = params.toString();
  return `${pathname}?${qs}${hash}`;
}

type SearchParamRecord = Record<string, string | string[] | undefined>;

function readPublicBrowseParam(params: SearchParamRecord | undefined): boolean {
  const value = params?.[PUBLIC_BROWSE_QUERY];
  if (value === "1") return true;
  return Array.isArray(value) && value.includes("1");
}

/** Build the query string passed into server-side guest-public redirect checks. */
export function mergeRedirectSearch(...parts: string[]): string {
  const merged = new URLSearchParams();
  for (const part of parts) {
    const raw = part.startsWith("?") ? part.slice(1) : part;
    if (!raw) continue;
    const params = new URLSearchParams(raw);
    params.forEach((value, key) => merged.set(key, value));
  }
  const qs = merged.toString();
  return qs ? `?${qs}` : "";
}

export function redirectSearchFromPageParams(
  params: SearchParamRecord | undefined,
  extraSearch = "",
): string {
  const merged = mergeRedirectSearch(extraSearch);
  if (!readPublicBrowseParam(params)) return merged;
  const sp = new URLSearchParams(merged.startsWith("?") ? merged.slice(1) : merged);
  sp.set(PUBLIC_BROWSE_QUERY, "1");
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Marketing / guest browse surfaces. Signed-in users are redirected to the
 * appropriate hub (`/dashboard`, `/organizer/*`, `/admin`) instead of seeing
 * duplicate public chrome.
 */
export function isGuestOnlyPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/events" || pathname.startsWith("/events/")) return true;
  if (pathname === "/organizers" || pathname.startsWith("/organizers/")) return true;
  if (pathname.startsWith("/e/")) return true;
  return false;
}

/** Primary hub landing when a signed-in user hits a guest-only marketing route. */
export function signedInHubLandingPath(roles: string[]): string {
  const normalized = normalizeWebUserRoles(roles);
  if (rolesIncludeAdmin(normalized)) return "/admin";
  if (normalized.includes("ATTENDEE")) return "/dashboard";
  if (normalized.includes("ORGANIZER")) return "/organizer/dashboard";
  return "/dashboard";
}

/**
 * Map a guest-only public URL to the signed-in equivalent. Preserves catalogue
 * query params when redirecting `/events` → `/dashboard/events`.
 */
export function resolveGuestOnlyPublicRedirect(
  pathname: string,
  search: string,
  roles: string[],
): string {
  const normalized = normalizeWebUserRoles(roles);
  const qs =
    search && search.startsWith("?")
      ? search
      : search
        ? `?${search}`
        : "";

  const nonAttendeeLanding = (() => {
    if (rolesIncludeAdmin(normalized)) return "/admin";
    if (
      normalized.includes("ORGANIZER") &&
      !normalized.includes("ATTENDEE")
    ) {
      return "/organizer/dashboard";
    }
    return null;
  })();

  if (pathname === "/events" || pathname === "/events/") {
    if (nonAttendeeLanding) return nonAttendeeLanding;
    return `/dashboard/events${qs}`;
  }

  const compMatch = pathname.match(/^\/e\/([^/]+)\/comp\/([^/]+)\/?$/);
  if (compMatch) {
    if (nonAttendeeLanding) return nonAttendeeLanding;
    return `/dashboard/events/${compMatch[1]}/comp/${compMatch[2]}`;
  }

  const slugMatch = pathname.match(/^\/e\/([^/]+)\/?$/);
  if (slugMatch) {
    if (nonAttendeeLanding) return nonAttendeeLanding;
    return `/dashboard/events/${slugMatch[1]}${qs}`;
  }

  if (pathname.startsWith("/events/")) {
    if (nonAttendeeLanding) return nonAttendeeLanding;
    return `/dashboard/events${qs}`;
  }

  if (pathname === "/organizers" || pathname.startsWith("/organizers/")) {
    if (rolesIncludeAdmin(normalized)) return "/admin";
    if (normalized.includes("ORGANIZER")) return "/organizer/dashboard";
    return "/dashboard";
  }

  if (pathname === "/") {
    return signedInHubLandingPath(normalized);
  }

  return signedInHubLandingPath(normalized);
}
