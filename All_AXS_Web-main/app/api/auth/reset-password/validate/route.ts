import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${API_URL}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { message: data?.message || "Invalid or expired reset token" },
        { status: response.status },
      );
    }

    return NextResponse.json({ message: "Token is valid" });
  } catch (error) {
    console.error("Reset token validation error:", error);
    return NextResponse.json(
      { message: "An error occurred while validating reset token" },
      { status: 500 },
    );
  }
}
