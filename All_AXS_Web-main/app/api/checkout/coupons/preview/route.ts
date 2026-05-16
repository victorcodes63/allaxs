import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy to `POST /checkout/coupons/preview` on the Nest API. The
 * underlying endpoint is JWT-optional so anonymous buyers can preview
 * a code on the public ticket page; we forward the access token when
 * present so signed-in buyers also get their per-user cap evaluated.
 */
const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    const body = await request.json();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}/checkout/coupons/preview`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to preview coupon" },
        { status: response.status },
      );
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Coupon preview proxy error:", error);
    return NextResponse.json(
      { message: "Unable to preview coupon" },
      { status: 500 },
    );
  }
}
