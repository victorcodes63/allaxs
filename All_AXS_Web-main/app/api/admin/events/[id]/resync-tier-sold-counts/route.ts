import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

// POST /api/admin/events/:id/resync-tier-sold-counts
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const API_URL = getServerApiBaseUrl();
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      );
    }

    const { id: eventId } = await params;
    const endpoint = `${API_URL}/admin/events/${eventId}/resync-tier-sold-counts`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type");
    let data: Record<string, unknown>;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));
      return NextResponse.json(
        {
          message: `Backend endpoint returned non-JSON response (${response.status})`,
        },
        { status: response.status || 500 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            (typeof data.message === "string" && data.message) ||
            `Failed to resync tier sold counts (${response.status})`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Resync tier sold counts error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while resyncing tier sold counts",
      },
      { status: 500 },
    );
  }
}
