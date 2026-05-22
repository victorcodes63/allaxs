import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  try {
    const { slug, token } = await params;
    const API_URL = getServerApiBaseUrl();
    const response = await fetch(
      `${API_URL}/events/by-slug/${encodeURIComponent(slug)}/comp/${encodeURIComponent(token)}`,
      {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Comp link not found" },
        { status: response.status },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Comp link preview proxy error:", error);
    return NextResponse.json({ message: "Unable to resolve comp link" }, { status: 500 });
  }
}
