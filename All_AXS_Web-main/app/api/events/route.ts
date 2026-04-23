import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// API routes proxy to backend NestJS API
// These routes handle cookie-based auth and forward requests to the backend
// Set API_URL env var to point to your backend (default: http://localhost:8080)
const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

// GET /api/events - List events for authenticated organizer
export async function GET() {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const endpoint = `${API_URL}/events`;

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
      // Handle specific error cases
      if (response.status === 403) {
        return NextResponse.json(
          {
            message: data.message || "You do not have permission to list events",
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
    console.error("Get events error:", error);
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

// POST /api/events - Create event
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const idempotencyKey = request.headers.get("idempotency-key");

    const endpoint = `${API_URL}/events`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
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
      // Handle specific error cases
      if (response.status === 403) {
        return NextResponse.json(
          {
            message: data.message || "You do not have permission to create events",
          },
          { status: 403 }
        );
      }
      if (response.status === 400) {
        // Validation errors - return as-is from backend
        return NextResponse.json(data, { status: 400 });
      }
      return NextResponse.json(
        {
          message: data.message || `Failed to create event (${response.status})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Create event error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while creating the event",
      },
      { status: 500 }
    );
  }
}

