import { NextRequest, NextResponse } from "next/server";
import {
  getServerApiBaseUrl,
  upstreamUnreachableMessage,
} from "@/lib/server/api-url";

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { message: "Verification token is required" },
        { status: 400 },
      );
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
    } catch (err) {
      const unreachable = upstreamUnreachableMessage(err, API_URL);
      if (unreachable) {
        return NextResponse.json({ message: unreachable }, { status: 503 });
      }
      throw err;
    }

    const contentType = response.headers.get("content-type") || "";
    let data: { message?: string } = {};
    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: data?.message || "Failed to verify email" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      message: data?.message || "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    if (unreachable) {
      return NextResponse.json({ message: unreachable }, { status: 503 });
    }
    return NextResponse.json(
      { message: "An error occurred while verifying your email" },
      { status: 500 },
    );
  }
}
