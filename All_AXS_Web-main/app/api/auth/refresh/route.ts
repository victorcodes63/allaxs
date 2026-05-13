import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";
import { formatUpstreamErrorMessage } from "@/lib/server/format-upstream-error-message";

export async function POST() {
  const API_URL = getServerApiBaseUrl();
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "Refresh token not found" },
        { status: 401 },
      );
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
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
      user?: unknown;
      tokens?: { accessToken?: string; refreshToken?: string };
    } = {};
    if (rawBody.trim()) {
      try {
        data = JSON.parse(rawBody) as typeof data;
      } catch {
        /* non-JSON upstream (e.g. HTML from a proxy) */
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            formatUpstreamErrorMessage(data) ?? "Token refresh failed",
        },
        { status: response.status },
      );
    }

    const { accessToken, refreshToken: newRefreshToken } = extractAuthTokens(data);

    if (accessToken) {
      cookieStore.set("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });
    }

    if (newRefreshToken) {
      cookieStore.set("refreshToken", newRefreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Refresh error:", error);
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    if (unreachable) {
      return NextResponse.json({ message: unreachable }, { status: 503 });
    }
    return NextResponse.json(
      { message: "An error occurred during token refresh" },
      { status: 500 },
    );
  }
}
