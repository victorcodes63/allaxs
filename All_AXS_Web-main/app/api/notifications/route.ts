import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

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
    const limit = request.nextUrl.searchParams.get("limit") ?? "8";
    const offset = request.nextUrl.searchParams.get("offset") ?? "0";
    const endpoint = `${API_URL}/notifications/me?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;

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
