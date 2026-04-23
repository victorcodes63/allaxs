import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// API routes proxy to backend NestJS API
// These routes handle cookie-based auth and forward requests to the backend
// Set API_URL env var to point to your backend (default: http://localhost:8080)
// 
// NOTE: These routes are kept for backward compatibility/mocking.
// Frontend should use the shared API client (lib/api-client.ts) to call Nest API directly.
// Set NEXT_PUBLIC_API_MOCK=1 to enable these proxy routes, otherwise they return 501.

const API_URL = process.env.API_URL || "http://localhost:8080";
const MOCK_ENABLED = process.env.NEXT_PUBLIC_API_MOCK === "1";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

// PATCH /api/events/[id]/ticket-types/[tierId] - Update ticket type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  // Guard: return 501 if mocks are disabled
  if (!MOCK_ENABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "TicketType FE route hit while NEXT_PUBLIC_API_MOCK != 1. Check API base URL / client."
      );
    }
    return NextResponse.json(
      {
        message:
          "FE mock disabled; use Nest API directly via NEXT_PUBLIC_API_BASE_URL",
      },
      { status: 501 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { tierId } = await params;
    const body = await request.json();

    // Backend endpoint: PATCH /ticket-types/:id
    const endpoint = `${API_URL}/ticket-types/${tierId}`;

    const response = await fetch(endpoint, {
      method: "PATCH",
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
            message: data.message || "You do not have permission to update ticket types for this event",
          },
          { status: 403 }
        );
      }
      if (response.status === 400) {
        return NextResponse.json(data, { status: 400 });
      }
      return NextResponse.json(
        {
          message: data.message || `Failed to update ticket type (${response.status})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update ticket type error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while updating the ticket type",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/ticket-types/[tierId] - Delete ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  // Guard: return 501 if mocks are disabled
  if (!MOCK_ENABLED) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "TicketType FE route hit while NEXT_PUBLIC_API_MOCK != 1. Check API base URL / client."
      );
    }
    return NextResponse.json(
      {
        message:
          "FE mock disabled; use Nest API directly via NEXT_PUBLIC_API_BASE_URL",
      },
      { status: 501 }
    );
  }

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { tierId } = await params;

    // Backend endpoint: DELETE /ticket-types/:id
    const endpoint = `${API_URL}/ticket-types/${tierId}`;

    const response = await fetch(endpoint, {
      method: "DELETE",
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
      // DELETE may return 204 No Content
      if (response.status === 204) {
        return new NextResponse(null, { status: 204 });
      }
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
            message: data.message || "You do not have permission to delete ticket types for this event",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          message: data.message || `Failed to delete ticket type (${response.status})`,
        },
        { status: response.status }
      );
    }

    // DELETE returns 204 No Content
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(data || { success: true });
  } catch (error) {
    console.error("Delete ticket type error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while deleting the ticket type",
      },
      { status: 500 }
    );
  }
}

