import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

async function readAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const API_URL = getServerApiBaseUrl();
    const response = await fetch(`${API_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: (data as { message?: string }).message || "Subscribe failed" },
        { status: response.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Push subscribe proxy error:", error);
    return NextResponse.json({ message: "Subscribe failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const API_URL = getServerApiBaseUrl();
    const response = await fetch(`${API_URL}/push/subscribe`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: (data as { message?: string }).message || "Unsubscribe failed" },
        { status: response.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Push unsubscribe proxy error:", error);
    return NextResponse.json({ message: "Unsubscribe failed" }, { status: 500 });
  }
}
