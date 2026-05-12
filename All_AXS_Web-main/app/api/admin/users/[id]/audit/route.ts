import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET(
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
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const backendUrl = new URL(`${API_URL}/admin/users/${id}/audit`);
    if (limit) backendUrl.searchParams.set("limit", limit);

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
          "An error occurred while loading the user audit history",
      },
      { status: 500 },
    );
  }
}
