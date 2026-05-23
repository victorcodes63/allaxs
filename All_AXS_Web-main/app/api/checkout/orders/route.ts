import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ?? "20";
    const offset = searchParams.get("offset") ?? "0";
    const qs = new URLSearchParams({ limit, offset });

    const response = await fetch(`${API_URL}/checkout/orders?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: (data as { message?: string }).message || "Unable to load orders" },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("List orders proxy error:", error);
    return NextResponse.json({ message: "Error loading orders" }, { status: 500 });
  }
}
