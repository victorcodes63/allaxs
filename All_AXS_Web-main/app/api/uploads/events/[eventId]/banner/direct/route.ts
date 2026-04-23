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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { eventId } = await params;
    const formData = await request.formData();

    const endpoint = `${API_URL}/uploads/events/${eventId}/banner/direct`;

    // Create a new FormData for the backend request
    const backendFormData = new FormData();
    const file = formData.get("file") as File;
    if (file) {
      backendFormData.append("file", file);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: backendFormData,
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
            message: data.message || "You do not have permission to upload banner for this event",
          },
          { status: 403 }
        );
      }
      if (response.status === 404) {
        return NextResponse.json(
          {
            message: data.message || "Event not found",
          },
          { status: 404 }
        );
      }
      if (response.status === 400) {
        // Validation errors - return as-is from backend
        return NextResponse.json(data, { status: 400 });
      }
      return NextResponse.json(
        {
          message:
            data.message || `Failed to upload banner (${response.status})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Direct upload error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while uploading the banner",
      },
      { status: 500 }
    );
  }
}

