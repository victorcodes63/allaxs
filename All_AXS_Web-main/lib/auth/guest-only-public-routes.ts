import { normalizeWebUserRoles, rolesIncludeAdmin } from "@/lib/auth/hub-routing";

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
