import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

const GENERIC_MESSAGE =
  "If an account with that email exists and is not verified, a verification email has been sent.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const response = await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json({
        message:
          typeof data?.message === "string" ? data.message : GENERIC_MESSAGE,
      });
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
