import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reference?: string };
    const reference = body.reference?.trim();
    if (!reference) {
      return NextResponse.json({ message: "Missing payment reference" }, { status: 400 });
    }

    const API_URL = getServerApiBaseUrl();
    const response = await fetch(
      `${API_URL}/checkout/orders/${orderId}/resend-tickets-by-reference`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to resend tickets" },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Public resend tickets proxy error:", error);
    return NextResponse.json({ message: "Unable to resend tickets" }, { status: 500 });
  }
}
