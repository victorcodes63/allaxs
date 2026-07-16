import { NextRequest, NextResponse } from "next/server";
import {
  authRateLimitResponse,
  checkAuthRouteRateLimit,
  clientIpFromRequest,
} from "@/lib/server/auth-rate-limit";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request);
  if (!checkAuthRouteRateLimit(`auth-forgot-password:${ip}`)) {
    return authRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { email, turnstileToken } = body;

    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, turnstileToken }),
    });

    if (response.ok) {
      return NextResponse.json({
        message: "If an account exists, a password reset email has been sent.",
      });
    }

    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    if (response.status === 400 && data.code?.startsWith("captcha")) {
      return NextResponse.json(
        { message: data.message || "Security verification failed.", code: data.code },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "If an account exists, a password reset email has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({
      message: "If an account exists, a password reset email has been sent.",
    });
  }
}
