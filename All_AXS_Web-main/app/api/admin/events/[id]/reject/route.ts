import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// API routes proxy to backend NestJS API
const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

// POST /api/admin/events/:id/reject - Reject event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id: eventId } = await params;
    const body = await request.json();
    const endpoint = `${API_URL}/admin/events/${eventId}/reject`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
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
            message: data.message || "You do not have permission to reject events",
          },
          { status: 403 }
        );
      }
      if (response.status === 400) {
        return NextResponse.json(data, { status: 400 });
      }
      if (response.status === 404) {
        return NextResponse.json(
          {
            message: data.message || "Event not found",
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          message: data.message || `Failed to reject event (${response.status})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reject event error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while rejecting the event",
      },
      { status: 500 }
    );
  }
}

