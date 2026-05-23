import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const response = await fetch(
      `${API_URL}/public/organizers/by-slug/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const contentType = response.headers.get("content-type");
    let data: unknown = null;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    }

    if (!response.ok) {
      return NextResponse.json(
        data ?? { message: `Failed to load store (${response.status})` },
        { status: response.status },
      );
    }
    return NextResponse.json(data ?? {});
  } catch (error) {
    console.error("Public organizer by-slug proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to load store" },
      { status: 500 },
    );
  }
}
