import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl, upstreamUnreachableMessage } from "@/lib/server/api-url";

const API_URL = getServerApiBaseUrl();

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token?.trim()) {
    return NextResponse.json({ valid: false, reason: "Token is required" });
  }

  try {
    const response = await fetch(
      `${API_URL}/events/waitlist/verify?token=${encodeURIComponent(token.trim())}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    return NextResponse.json(
      { valid: false, reason: unreachable || "Could not verify token" },
      { status: 502 },
    );
  }
}
