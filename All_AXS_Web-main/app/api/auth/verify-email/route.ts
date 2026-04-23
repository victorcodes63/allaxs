import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data?.message || "Failed to verify email" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: data?.message || "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { message: "An error occurred while verifying your email" },
      { status: 500 }
    );
  }
}


