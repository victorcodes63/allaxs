import axios from "axios";

export type AuthIntent = "attend" | "host";

export function parseIntent(raw: string | null): AuthIntent | null {
  if (raw === "attend" || raw === "host") return raw;
  return null;
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
  if (!roles.includes("ORGANIZER")) {
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

export function resolvePostAuthRedirect(options: {
  nextParam: string | null;
  intent: AuthIntent | null;
  roles: string[];
  hasOrganizerProfile: boolean;
}): string {
  const sanitized = sanitizeNextPath(options.nextParam);
  if (sanitized) {
    return sanitized;
  }

  const { intent, roles, hasOrganizerProfile } = options;
  const isOrganizer = roles.includes("ORGANIZER");
  const isAdmin = roles.includes("ADMIN");

  if (intent === "attend") {
    return "/events";
  }

  if (intent === "host") {
    if (!isOrganizer) return "/dashboard";
    if (!hasOrganizerProfile) return "/organizer/onboarding";
    return "/organizer/dashboard";
  }

  if (isAdmin && !isOrganizer) {
    // Pure admin accounts (e.g. the seeded `demo-admin@allaxs.demo`) have no
    // attendee or organiser hub of their own — land them on the moderation
    // overview which is the primary admin workspace.
    return "/admin";
  }

  if (isOrganizer) {
    if (!hasOrganizerProfile) return "/organizer/onboarding";
    return "/organizer/dashboard";
  }

  return "/dashboard";
}
