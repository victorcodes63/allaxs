import { NextRequest, NextResponse } from "next/server";
import {
  authRateLimitResponse,
  checkAuthRouteRateLimit,
  clientIpFromRequest,
} from "@/lib/server/auth-rate-limit";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { setAuthCookiesOnResponse } from "@/lib/server/auth-cookies";
import {
  formatUpstreamErrorMessage,
  extractUpstreamErrorCode,
} from "@/lib/server/format-upstream-error-message";

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();
  const ip = clientIpFromRequest(request);
  if (!checkAuthRouteRateLimit(`auth-login:${ip}`)) {
    return authRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { email, password, intent, turnstileToken } = body;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          turnstileToken,
          ...(intent === "attend" || intent === "host" ? { intent } : {}),
        }),
      });
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
      tokens?: { accessToken?: string; refreshToken?: string };
      user?: unknown;
    } = {};
    if (rawBody.trim()) {
      try {
        data = JSON.parse(rawBody) as typeof data;
      } catch {
        /* non-JSON */
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message: formatUpstreamErrorMessage(data) ?? "Login failed",
          code: extractUpstreamErrorCode(data),
        },
        { status: response.status },
      );
    }

    const { accessToken, refreshToken } = extractAuthTokens(data);
    const res = NextResponse.json({ user: data.user });
    setAuthCookiesOnResponse(res, { accessToken, refreshToken });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    if (unreachable) {
      return NextResponse.json({ message: unreachable }, { status: 503 });
    }
    return NextResponse.json(
      { message: "An error occurred during login" },
      { status: 500 },
    );
  }
}
