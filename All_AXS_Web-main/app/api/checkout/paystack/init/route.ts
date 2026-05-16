import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/public-events-mode";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = (await request.json()) as {
      eventId?: string;
      ticketTypeId?: string;
    };
    if (body.eventId && !isUuid(body.eventId)) {
      return NextResponse.json(
        {
          message:
            "This listing uses demo data. Browse /events for live events, or set NEXT_PUBLIC_USE_DEMO_EVENTS=false on deploy.",
        },
        { status: 400 },
      );
    }
    if (body.ticketTypeId && !isUuid(body.ticketTypeId)) {
      return NextResponse.json(
        { message: "Invalid ticket type for checkout. Refresh the event page and try again." },
        { status: 400 },
      );
    }
    const response = await fetch(`${API_URL}/checkout/paystack/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to initialize payment" },
        { status: response.status }
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Paystack init proxy error:", error);
    return NextResponse.json({ message: "Unable to initialize payment" }, { status: 500 });
  }
}
