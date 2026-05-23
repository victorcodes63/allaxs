import { normalizeWebUserRoles } from "@/lib/auth/hub-routing";

export type AccessTokenPayload = {
  sub?: string;
  id?: string;
  email?: string;
  name?: string;
  roles?: string[];
  autoCreatedAt?: string;
  emailVerified?: boolean;
  exp?: number;
};

/** Decode JWT payload without verification (same-origin httpOnly cookie only). */
export function decodeAccessTokenPayload(
  token: string,
): AccessTokenPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonPayload) as AccessTokenPayload & {
      roles?: unknown;
    };
    return {
      ...parsed,
      roles: normalizeWebUserRoles(parsed.roles),
    };
  } catch {
    return null;
  }
}

export function accessTokenIsExpired(payload: AccessTokenPayload): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
