import type { AuthIntent } from "@/lib/auth/post-auth-redirect";
import { normalizeWebUserRoles, rolesIncludeAdmin } from "@/lib/auth/hub-routing";

export type SignInIntentCheckResult =
  | { ok: true }
  | { ok: false; code: "noHostAccount" | "noFanAccount"; message: string };

/** True when the database `users.roles` includes host workspace access. */
export function userHasHostAccountInDb(roles: unknown): boolean {
  const normalized = normalizeWebUserRoles(roles);
  return normalized.includes("ORGANIZER") || rolesIncludeAdmin(normalized);
}

/** True when the database `users.roles` includes fan / ticket buyer access. */
export function userHasFanAccountInDb(roles: unknown): boolean {
  const normalized = normalizeWebUserRoles(roles);
  if (rolesIncludeAdmin(normalized)) return true;
  if (normalized.includes("ATTENDEE")) return true;
  // Hosts with only ORGANIZER may still buy tickets once promoted; fan tab is OK.
  return normalized.includes("ORGANIZER");
}

/**
 * Validate sign-in intent (Fan / Host toggle) against authoritative DB roles
 * returned from `/api/auth/me` — backup to the API login gate.
 */
export function validateSignInIntentAgainstDbRoles(
  intent: AuthIntent | null,
  roles: unknown,
): SignInIntentCheckResult {
  if (intent === "host") {
    if (userHasHostAccountInDb(roles)) return { ok: true };
    return {
      ok: false,
      code: "noHostAccount",
      message:
        "No host account exists for the email address provided. Use the Fan tab for tickets, or sign up as a host to create an organizer account.",
    };
  }

  if (intent === "attend") {
    if (userHasFanAccountInDb(roles)) return { ok: true };
    return {
      ok: false,
      code: "noFanAccount",
      message:
        "No fan account exists for the email address provided. Use the Host tab if you are an organizer.",
    };
  }

  return { ok: true };
}
