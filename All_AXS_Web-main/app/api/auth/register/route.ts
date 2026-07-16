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

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();
  const ip = clientIpFromRequest(request);
  if (!checkAuthRouteRateLimit(`auth-register:${ip}`)) {
    return authRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { email, name, password, turnstileToken } = body;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name, password, turnstileToken }),
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
      code?: string;
      user?: unknown;
      requiresEmailVerification?: boolean;
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
        { message: data.message || "Registration failed", code: data.code },
        { status: response.status },
      );
    }

    return NextResponse.json({
      user: data.user,
      requiresEmailVerification: data.requiresEmailVerification ?? true,
    });
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
