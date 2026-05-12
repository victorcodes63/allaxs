import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET(
  _request: Request,
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

    const { id } = await params;
    const response = await fetch(`${API_URL}/admin/events/${id}`, {
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
          "An error occurred while loading the event",
      },
      { status: 500 },
    );
  }
}
