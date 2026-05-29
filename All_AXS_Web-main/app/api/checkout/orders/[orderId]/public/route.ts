import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const reference = request.nextUrl.searchParams.get("reference");
    if (!reference?.trim()) {
      return NextResponse.json({ message: "Missing payment reference" }, { status: 400 });
    }

    const API_URL = getServerApiBaseUrl();
    const response = await fetch(
      `${API_URL}/checkout/orders/${orderId}/public?reference=${encodeURIComponent(reference.trim())}`
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Not found" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Public order summary proxy error:", error);
    return NextResponse.json({ message: "Error loading order" }, { status: 500 });
  }
}
