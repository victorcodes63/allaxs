import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

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

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const limit = searchParams.get("limit") ?? "25";
    const offset = searchParams.get("offset") ?? "0";

    const qs = new URLSearchParams();
    if (eventId) qs.set("eventId", eventId);
    qs.set("limit", limit);
    qs.set("offset", offset);

    const endpoint = `${API_URL}/organizers/sales/orders?${qs.toString()}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type");
    let data: unknown;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Organizer sales orders non-JSON:", text.substring(0, 200));
      return NextResponse.json(
        { message: `Unexpected response (${response.status})` },
        { status: response.status || 500 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          message:
            (data as { message?: string })?.message ||
            `Failed to load orders (${response.status})`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Organizer sales orders proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error loading orders" },
      { status: 500 },
    );
  }
}
