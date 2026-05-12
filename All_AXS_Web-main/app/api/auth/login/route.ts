import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { formatUpstreamErrorMessage } from "@/lib/server/format-upstream-error-message";

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();

  try {
    const body = await request.json();
    const { email, password } = body;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
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
        /* non-JSON (e.g. HTML from a proxy); leave data empty */
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            formatUpstreamErrorMessage(data) ?? "Login failed",
        },
        { status: response.status },
      );
    }

    const { accessToken, refreshToken } = extractAuthTokens(data);
    const cookieStore = await cookies();

    if (accessToken) {
      cookieStore.set("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60,
      });
    }

    if (refreshToken) {
      cookieStore.set("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return NextResponse.json({ user: data.user });
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
