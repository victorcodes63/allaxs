import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:8080";

// Helper to get access token from cookies
async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET() {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    // Call backend to get organizer profile
    // TODO: Verify the exact endpoint path with backend team
    // Common variations: /organizers/profile, /organizer/profile, /organizers/me
    const endpoint = `${API_URL}/organizers/profile`;
    
    console.log(`GETting from: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 404) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    // Handle non-JSON responses
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));
      return NextResponse.json(
        {
          message: `Backend endpoint not found. Expected GET ${endpoint} but got ${response.status}. Please verify the endpoint exists.`,
        },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error("Backend error:", {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(
        {
          message:
            data.message ||
            `Failed to fetch profile (${response.status}: ${response.statusText})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get organizer profile error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while fetching profile. Please check if the backend is running and the endpoint exists.",
      },
      { status: 500 }
    );
  }
}

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

    // Call backend to create/update organizer profile
    // TODO: Verify the exact endpoint path with backend team
    // Common variations: /organizers/profile, /organizer/profile, /organizers/me
    const endpoint = `${API_URL}/organizers/profile`;
    
    console.log(`POSTing to: ${endpoint}`);
    console.log(`Body:`, JSON.stringify(body, null, 2));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    // Handle non-JSON responses (like 404 HTML pages)
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200));
      return NextResponse.json(
        {
          message: `Backend endpoint not found. Expected POST ${endpoint} but got ${response.status}. Please verify the endpoint exists.`,
        },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error("Backend error:", {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(
        {
          message:
            data.message ||
            `Failed to save profile (${response.status}: ${response.statusText})`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Save organizer profile error:", error);
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while saving profile. Please check if the backend is running and the endpoint exists.",
      },
      { status: 500 }
    );
  }
}

