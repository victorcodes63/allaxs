import axios from "axios";
import { rolesIncludeAdmin } from "@/lib/auth/hub-routing";

export type AuthIntent = "attend" | "host";

export function parseIntent(raw: string | null): AuthIntent | null {
  if (raw === "attend" || raw === "host") return raw;
  return null;
}

/**
 * When the path picker is omitted, infer a sensible default from JWT roles.
 */
export function inferIntentFromRoles(roles: string[]): AuthIntent | null {
  if (rolesIncludeAdmin(roles)) return null;
  if (roles.includes("ORGANIZER")) return "host";
  if (roles.includes("ATTENDEE")) return "attend";
  return null;
}

/** Path + intent used together on `/login` and `/register` when session is required. */
export function buildLoginRedirectFromPath(pathname: string): string {
  const next = pathname.startsWith("/") ? pathname : `/${pathname}`;
  let intent: AuthIntent | null = null;
  if (next.startsWith("/organizer")) {
    intent = "host";
  } else if (
    next === "/dashboard" ||
    next.startsWith("/dashboard/") ||
    next === "/tickets" ||
    next.startsWith("/tickets/") ||
    next === "/notifications" ||
    next.startsWith("/notifications/")
  ) {
    intent = "attend";
  }
  return `/login${buildAuthQuery({ next, intent })}`;
}

/**
 * Same-origin path only — blocks protocol-relative and obvious open redirects.
 */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\0")) return null;
  const lower = trimmed.toLowerCase();
  if (lower.includes("://")) return null;
  return trimmed;
}

export function buildAuthQuery(params: {
  next?: string | null;
  intent?: AuthIntent | null;
}): string {
  const sp = new URLSearchParams();
  const next = sanitizeNextPath(params.next ?? null);
  if (next) sp.set("next", next);
  if (params.intent) sp.set("intent", params.intent);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function fetchPostAuthSnapshot(): Promise<{
  roles: string[];
  hasOrganizerProfile: boolean;
}> {
  const { data } = await axios.get<{ user?: { roles?: string[] } }>("/api/auth/me");
  const roles = data.user?.roles ?? [];
  if (!roles.includes("ORGANIZER") || rolesIncludeAdmin(roles)) {
    return { roles, hasOrganizerProfile: false };
  }
  try {
    await axios.get("/api/organizer/profile");
    return { roles, hasOrganizerProfile: true };
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      return { roles, hasOrganizerProfile: false };
    }
    return { roles, hasOrganizerProfile: false };
  }
}

function isFanHomePath(path: string): boolean {
  return (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/tickets" ||
    path.startsWith("/tickets/") ||
    path === "/notifications" ||
    path.startsWith("/notifications/")
  );
}

function isOrganizerAppPath(path: string): boolean {
  return path === "/organizer" || path.startsWith("/organizer/");
}

function hostLandingPath(
  roles: string[],
  hasOrganizerProfile: boolean,
): string {
  if (rolesIncludeAdmin(roles)) return "/admin";
  if (!roles.includes("ORGANIZER")) return "/dashboard";
  if (!hasOrganizerProfile) return "/organizer/onboarding";
  return "/organizer/dashboard";
}

/**
 * Reconcile a post-login `next` path with JWT roles so stale bookmarks and
 * organizer logout redirects cannot trap moderators on fan/host onboarding.
 */
export function adjustNextPathForRoles(
  path: string,
  roles: string[],
  hasOrganizerProfile: boolean,
): string {
  if (rolesIncludeAdmin(roles) && path.startsWith("/organizer")) {
    return "/admin";
  }

  if (roles.includes("ORGANIZER") && !hasOrganizerProfile) {
    if (path === "/organizer/dashboard" || path.startsWith("/organizer/dashboard/")) {
      return "/organizer/onboarding";
    }
  }

  return path;
}

/**
 * `?next=` must not override an explicit path picker (`intent=host|attend`).
 * e.g. login?next=/dashboard&intent=host → organizer dashboard, not fan home.
 */
export function reconcileNextWithIntent(
  path: string,
  intent: AuthIntent | null,
  roles: string[],
  hasOrganizerProfile: boolean,
): string {
  const adjusted = adjustNextPathForRoles(path, roles, hasOrganizerProfile);

  if (intent === "host") {
    if (rolesIncludeAdmin(roles)) {
      if (isFanHomePath(adjusted) || isOrganizerAppPath(adjusted)) {
        return "/admin";
      }
      return adjusted;
    }
    if (isFanHomePath(adjusted)) {
      return hostLandingPath(roles, hasOrganizerProfile);
    }
    return adjusted;
  }

  if (intent === "attend") {
    if (isOrganizerAppPath(adjusted)) {
      return "/dashboard";
    }
    return adjusted;
  }

  return adjusted;
}

export function resolvePostAuthRedirect(options: {
  nextParam: string | null;
  intent: AuthIntent | null;
  roles: string[];
  hasOrganizerProfile: boolean;
}): string {
  const { roles, hasOrganizerProfile } = options;
  const intent =
    options.intent ?? inferIntentFromRoles(roles);

  const sanitized = sanitizeNextPath(options.nextParam);
  if (sanitized) {
    return reconcileNextWithIntent(
      sanitized,
      intent,
      roles,
      hasOrganizerProfile,
    );
  }

  const isOrganizer = roles.includes("ORGANIZER");
  const isAdmin = rolesIncludeAdmin(roles);

  if (intent === "attend") {
    return "/dashboard";
  }

  if (intent === "host") {
    return hostLandingPath(roles, hasOrganizerProfile);
  }

  if (isAdmin) {
    return "/admin";
  }

  if (isOrganizer) {
    if (!hasOrganizerProfile) return "/organizer/onboarding";
    return "/organizer/dashboard";
  }

  return "/dashboard";
}
