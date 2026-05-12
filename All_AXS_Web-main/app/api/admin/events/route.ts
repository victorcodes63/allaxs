import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

// GET /api/admin/events - List events for admin with status filter
export async function GET(request: NextRequest) {
  try {
    const API_URL = getServerApiBaseUrl();
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const queryParams = new URLSearchParams();
    if (status) {
      queryParams.append("status", status);
    }
    if (search) {
      queryParams.append("search", search);
    }

    const endpoint = `${API_URL}/admin/events${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));
      return NextResponse.json(
        {
          message: `Backend endpoint returned non-JSON response (${response.status})`,
        },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          {
            message: data.message || "You do not have permission to access this resource",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          message: data.message || `Failed to fetch events (${response.status})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get admin events error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while fetching events",
      },
      { status: 500 }
    );
  }
}

