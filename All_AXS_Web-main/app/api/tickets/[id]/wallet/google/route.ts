import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/tickets/${id}/wallet/google`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = (await response.json().catch(() => ({}))) as {
      saveUrl?: string;
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Google Wallet pass unavailable" },
        { status: response.status }
      );
    }

    if (data.saveUrl) {
      return NextResponse.redirect(data.saveUrl);
    }

    return NextResponse.json({ message: "Invalid wallet response" }, { status: 502 });
  } catch (error) {
    console.error("Google Wallet proxy error:", error);
    return NextResponse.json({ message: "Error loading Google Wallet pass" }, { status: 500 });
  }
}
