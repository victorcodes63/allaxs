import { NextRequest, NextResponse } from "next/server";
import {
  authRateLimitResponse,
  checkAuthRouteRateLimit,
  clientIpFromRequest,
} from "@/lib/server/auth-rate-limit";

const API_URL = process.env.API_URL || "http://localhost:8080";

const GENERIC_MESSAGE =
  "If an account with that email exists and is not verified, a verification email has been sent.";

export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request);
  if (!checkAuthRouteRateLimit(`auth-resend-verification:${ip}`)) {
    return authRateLimitResponse();
  }

  try {
    const body = await request.json();
    const { email, turnstileToken } = body;

    const response = await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, turnstileToken }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json({
        message:
          typeof data?.message === "string" ? data.message : GENERIC_MESSAGE,
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

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
