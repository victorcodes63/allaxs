import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl, upstreamUnreachableMessage } from "@/lib/server/api-url";

const API_URL = getServerApiBaseUrl();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string; tierId: string }> },
) {
  const { eventId, tierId } = await context.params;

  try {
    const body = await request.json();
    const accessToken = request.cookies.get("accessToken")?.value;

    const response = await fetch(
      `${API_URL}/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(tierId)}/waitlist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Could not join waitlist" },
        { status: response.status },
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const unreachable = upstreamUnreachableMessage(error, API_URL);
    return NextResponse.json(
      { message: unreachable || "Could not join waitlist" },
      { status: 502 },
    );
  }
}
