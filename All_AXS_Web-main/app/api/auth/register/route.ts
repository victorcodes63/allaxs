import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";
import { extractAuthTokens } from "@/lib/server/auth-tokens";

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();

  try {
    const body = await request.json();
    const { email, name, password } = body;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name, password }),
      });
    } catch (err) {
      const unreachable = upstreamUnreachableMessage(err, API_URL);
      if (unreachable) {
        return NextResponse.json({ message: unreachable }, { status: 503 });
      }
      throw err;
    }

    const contentType = response.headers.get("content-type") || "";
    let data: {
      message?: string;
      tokens?: { accessToken?: string; refreshToken?: string };
      user?: unknown;
    } = {};
    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Registration failed" },
        { status: response.status },
      );
    }

    // Set cookies for tokens (auto-login after register)
    const { accessToken, refreshToken } = extractAuthTokens(data);
    const cookieStore = await cookies();

    if (accessToken) {
      cookieStore.set("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });
    }

    if (refreshToken) {
      cookieStore.set("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Register error:", error);
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    if (unreachable) {
      return NextResponse.json({ message: unreachable }, { status: 503 });
    }
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 },
    );
  }
}

