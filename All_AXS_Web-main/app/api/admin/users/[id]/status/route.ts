import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      );
    }

    const { id } = await params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const response = await fetch(`${API_URL}/admin/users/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body ?? {}),
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
          "An error occurred while updating user status",
      },
      { status: 500 },
    );
  }
}
