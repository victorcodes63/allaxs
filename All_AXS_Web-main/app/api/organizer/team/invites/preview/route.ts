import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

/** Public invite preview — no auth required. */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token?.trim()) {
      return NextResponse.json({ message: "Missing invite token" }, { status: 400 });
    }

    const url = new URL(`${API_URL}/organizers/team/invites/preview`);
    url.searchParams.set("token", token);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const contentType = response.headers.get("content-type");
    let data: unknown;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      return NextResponse.json(
        { message: `Unexpected response (${response.status})` },
        { status: response.status || 500 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Organizer team invite preview proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error loading invite" },
      { status: 500 },
    );
  }
}
