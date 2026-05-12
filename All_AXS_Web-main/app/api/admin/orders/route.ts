import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

const FORWARDED_PARAMS = [
  "status",
  "eventId",
  "organizerId",
  "search",
  "from",
  "to",
  "limit",
  "offset",
];

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET(request: Request) {
  try {
    const API_URL = getServerApiBaseUrl();
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const backendUrl = new URL(`${API_URL}/admin/orders`);
    for (const key of FORWARDED_PARAMS) {
      const value = searchParams.get(key);
      if (value && value.trim().length > 0) {
        backendUrl.searchParams.set(key, value);
      }
    }

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      return NextResponse.json(
        {
          message: `Backend returned non-JSON response (${response.status})`,
          preview: text.slice(0, 200),
        },
        { status: response.status || 500 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while loading the orders list",
      },
      { status: 500 },
    );
  }
}
