/**
 * Helpers for picking the right hub shell + landing path based on a user's
 * roles. Shared by `/dashboard`, `/notifications`, and `/tickets` layouts so
 * pure-admin or pure-organizer accounts don't get dropped into the fan hub.
 */

export type RoleLike = string | undefined;

/**
 * Coerce `user.roles` (or JWT `roles`) into uppercase string tokens. Handles
 * comma-separated strings and ignores non-strings so hub routing stays stable.
 */
export function normalizeWebUserRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  const out: string[] = [];
  for (const item of roles) {
    if (typeof item !== "string") continue;
    for (const part of item.split(",")) {
      const t = part.trim().toUpperCase();
      if (t) out.push(t);
    }
  }
  return out;
}

export function userHasRole(
  user: { roles?: RoleLike[] | null } | null | undefined,
  role: "ADMIN" | "ATTENDEE" | "ORGANIZER",
): boolean {
  return normalizeWebUserRoles(user?.roles).includes(role);
}

/** True when the account has platform moderation access. */
export function rolesIncludeAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

/**
 * Host nav / organizer flows are hidden for admin accounts — including when
 * `promote-organizer-demo` has added ATTENDEE+ORGANIZER to a moderator login.
 */
export function shouldOfferOrganizerHub(roles: string[]): boolean {
  return roles.includes("ORGANIZER") && !roles.includes("ADMIN");
}

/**
 * Fan ↔ host switch in the hub top bar: only for accounts that are both a
 * ticket buyer (ATTENDEE) and a listed host (ORGANIZER). Uses strict array
 * checks so malformed `roles` payloads never show the control.
 */
export function userCanSwitchAttendeeOrganizerHub(
  user: { roles?: RoleLike[] | null } | null | undefined,
): boolean {
  if (!user) return false;
  const r = normalizeWebUserRoles(user.roles);
  return r.includes("ATTENDEE") && r.includes("ORGANIZER");
}

/**
 * Where a signed-in user should land if a shared hub page (e.g. /dashboard)
 * doesn't have meaningful content for their role. Returns null when the
 * default (attendee) shell is appropriate.
 *
 * **ATTENDEE must win when present** — many hosts are ATTENDEE+ORGANIZER. If we
 * preferred ORGANIZER here, visiting `/dashboard` would immediately redirect
 * back to `/organizer/dashboard`, which breaks the hub "Attendee view" switch.
 */
export function landingPathForNonAttendee(
  user: { roles?: RoleLike[] | null } | null | undefined,
): string | null {
  if (!user) return null;
  // Moderation accounts take precedence over fan-home, even when promote-organizer
  // has added ATTENDEE to the same JWT.
  if (userHasRole(user, "ADMIN")) return "/admin";
  if (userHasRole(user, "ATTENDEE")) return null;
  if (userHasRole(user, "ORGANIZER")) return "/organizer/dashboard";
  return null;
}

/** Which hub shell should wrap pages that are accessible to all signed-in users (e.g. /notifications). */
export type HubShellChoice = "attendee" | "admin" | "organizer";

export function preferredHubShell(
  user: { roles?: RoleLike[] | null } | null | undefined,
): HubShellChoice {
  if (userHasRole(user, "ATTENDEE")) return "attendee";
  if (userHasRole(user, "ADMIN")) return "admin";
  if (userHasRole(user, "ORGANIZER")) return "organizer";
  return "attendee";
}
