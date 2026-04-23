import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    // Always return a generic success message for security
    // Don't reveal whether the account exists or not
    if (response.ok) {
      return NextResponse.json({
        message: "If an account exists, a password reset email has been sent.",
      });
    }

    // Even on error, return generic message
    return NextResponse.json({
      message: "If an account exists, a password reset email has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    // Still return generic message on error
    return NextResponse.json({
      message: "If an account exists, a password reset email has been sent.",
    });
  }
}

