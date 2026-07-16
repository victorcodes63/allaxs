import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { clearAuthCookies } from "@/lib/server/clear-auth-cookies";
import { setAuthCookiesOnResponse } from "@/lib/server/auth-cookies";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";
import { formatUpstreamErrorMessage, extractUpstreamErrorCode } from "@/lib/server/format-upstream-error-message";

/** Coalesce parallel refresh calls that share the same refresh cookie (multi-tab / proxy + client). */
const refreshByToken = new Map<string, Promise<Response>>();

function refreshKey(token: string): string {
  return token.length > 48 ? token.slice(0, 48) : token;
}

async function upstreamRefresh(refreshToken: string): Promise<Response> {
  const API_URL = getServerApiBaseUrl();
  return fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function POST() {
  const API_URL = getServerApiBaseUrl();
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      const res = NextResponse.json(
        { message: "Refresh token not found", code: "noRefreshToken" },
        { status: 401 },
      );
      return clearAuthCookies(res);
    }

    const key = refreshKey(refreshToken);
    let upstream = refreshByToken.get(key);
    if (!upstream) {
      upstream = upstreamRefresh(refreshToken).finally(() => {
        refreshByToken.delete(key);
      });
      refreshByToken.set(key, upstream);
    }

    let response: Response;
    try {
      response = await upstream;
    } catch (err) {
      const unreachable = upstreamUnreachableMessage(err, API_URL);
      if (unreachable) {
        return NextResponse.json({ message: unreachable }, { status: 503 });
      }
      throw err;
    }

    const rawBody = await response.text();
    let data: {
      message?: unknown;
      code?: string;
      user?: unknown;
      tokens?: { accessToken?: string; refreshToken?: string };
    } = {};
    if (rawBody.trim()) {
      try {
        data = JSON.parse(rawBody) as typeof data;
      } catch {
        /* non-JSON upstream */
      }
    }

    if (!response.ok) {
      const code = extractUpstreamErrorCode(data);
      const res = NextResponse.json(
        {
          message: formatUpstreamErrorMessage(data) ?? "Token refresh failed",
          code: typeof code === "string" ? code : undefined,
        },
        { status: code === "refreshConcurrent" ? 409 : response.status },
      );
      if (response.status === 401 && code !== "refreshConcurrent") {
        return clearAuthCookies(res);
      }
      return res;
    }

    const { accessToken, refreshToken: newRefreshToken } = extractAuthTokens(data);

    const ok = NextResponse.json({ user: data.user });
    setAuthCookiesOnResponse(ok, {
      accessToken,
      refreshToken: newRefreshToken,
    });

    return ok;
  } catch (error) {
    console.error("Refresh error:", error);
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    if (unreachable) {
      return NextResponse.json({ message: unreachable }, { status: 503 });
    }
    const res = NextResponse.json(
      { message: "An error occurred during token refresh", code: "refreshError" },
      { status: 500 },
    );
    return clearAuthCookies(res);
  }
}
