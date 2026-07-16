import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { decodeAccessTokenPayload } from "@/lib/auth/jwt-payload";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { setAuthCookiesOnResponse } from "@/lib/server/auth-cookies";

export type SessionAccess = {
  accessToken: string | null;
  /** Apply rotated cookies onto a successful (or 401) route response. */
  applyRotatedCookies: (response: NextResponse) => NextResponse;
};

type RotatedTokens = { accessToken: string; refreshToken: string };

const refreshInFlight = new Map<string, Promise<RotatedTokens | null>>();

function refreshKey(token: string): string {
  return token.length > 48 ? token.slice(0, 48) : token;
}

function accessNeedsRefresh(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  const payload = decodeAccessTokenPayload(accessToken);
  if (!payload?.exp) return false;
  // Refresh a bit early so API calls don't race the exact expiry second.
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + 60;
}

async function upstreamRefresh(refreshToken: string): Promise<RotatedTokens | null> {
  const API_URL = getServerApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  const tokens = extractAuthTokens(data);
  if (!tokens.accessToken || !tokens.refreshToken) return null;
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * Return a usable access JWT for route handlers. If the cookie is missing or
 * near expiry, rotate via the refresh cookie and expose Set-Cookie helpers.
 */
export async function resolveSessionAccess(): Promise<SessionAccess> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  let rotated: RotatedTokens | null = null;

  if (accessNeedsRefresh(accessToken)) {
    if (!refreshToken) {
      return {
        accessToken: null,
        applyRotatedCookies: (response) => response,
      };
    }

    const key = refreshKey(refreshToken);
    let pending = refreshInFlight.get(key);
    if (!pending) {
      pending = upstreamRefresh(refreshToken).finally(() => {
        refreshInFlight.delete(key);
      });
      refreshInFlight.set(key, pending);
    }
    rotated = await pending;

    return {
      accessToken: rotated?.accessToken ?? null,
      applyRotatedCookies: (response) =>
        rotated ? setAuthCookiesOnResponse(response, rotated) : response,
    };
  }

  return {
    accessToken: accessToken ?? null,
    applyRotatedCookies: (response) => response,
  };
}

/**
 * After Nest returns 401 with an existing access cookie, try one refresh+retry
 * using the refresh cookie (covers clock skew / already-expired tokens that
 * still looked valid to our cheap `exp` check).
 */
export async function refreshSessionAccessForced(): Promise<SessionAccess> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;
  if (!refreshToken) {
    return {
      accessToken: null,
      applyRotatedCookies: (response) => response,
    };
  }

  const key = refreshKey(refreshToken);
  let pending = refreshInFlight.get(key);
  if (!pending) {
    pending = upstreamRefresh(refreshToken).finally(() => {
      refreshInFlight.delete(key);
    });
    refreshInFlight.set(key, pending);
  }
  const rotated = await pending;

  return {
    accessToken: rotated?.accessToken ?? null,
    applyRotatedCookies: (response) =>
      rotated ? setAuthCookiesOnResponse(response, rotated) : response,
  };
}
