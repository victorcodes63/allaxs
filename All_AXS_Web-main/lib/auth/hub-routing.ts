/**
 * Helpers for picking the right hub shell + landing path based on a user's
 * roles. Shared by `/dashboard`, `/notifications`, and `/tickets` layouts so
 * pure-admin or pure-organizer accounts don't get dropped into the fan hub.
 */

export type RoleLike = string | undefined;

export function userHasRole(
  user: { roles?: RoleLike[] | null } | null | undefined,
  role: "ADMIN" | "ATTENDEE" | "ORGANIZER",
): boolean {
  return Array.isArray(user?.roles) ? user!.roles!.includes(role) : false;
}

/**
 * Where a signed-in user should land if a shared hub page (e.g. /dashboard)
 * doesn't have meaningful content for their role. Returns null when the
 * default (attendee) shell is appropriate.
 */
export function landingPathForNonAttendee(
  user: { roles?: RoleLike[] | null } | null | undefined,
): string | null {
  if (!user) return null;
  if (userHasRole(user, "ATTENDEE")) return null;
  if (userHasRole(user, "ADMIN")) return "/admin";
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
