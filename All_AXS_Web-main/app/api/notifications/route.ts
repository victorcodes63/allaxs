import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { nestRouteMissing } from "@/lib/server/nest-route-missing";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const API_URL = getServerApiBaseUrl();
    const limitRaw = request.nextUrl.searchParams.get("limit") ?? "8";
    const offsetRaw = request.nextUrl.searchParams.get("offset") ?? "0";
    const limit = Math.max(1, Math.min(Number.parseInt(limitRaw, 10) || 8, 25));
    const offset = Math.max(0, Number.parseInt(offsetRaw, 10) || 0);
    const endpoint = `${API_URL}/notifications/me?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? await response.json()
      : { message: "Unexpected response format" };

    if (!response.ok) {
      if (nestRouteMissing(response.status, data, "/notifications/me")) {
        return NextResponse.json({
          notifications: [],
          unreadCount: 0,
          total: 0,
          limit,
          offset,
        });
      }
      return NextResponse.json(
        {
          message:
            (data as { message?: string })?.message ||
            `Failed to load notifications (${response.status})`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Notifications proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error loading notifications" },
      { status: 500 },
    );
  }
}
