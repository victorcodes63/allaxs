import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function POST(request: Request) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.payload !== "string" || typeof body.action !== "string") {
      return NextResponse.json({ message: "Invalid body" }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/organizers/tickets/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        payload: body.payload,
        action: body.action,
        ...(typeof body.gateId === "string" ? { gateId: body.gateId } : {}),
        ...(typeof body.deviceId === "string" ? { deviceId: body.deviceId } : {}),
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "Scan failed" },
      { status: 500 }
    );
  }
}
