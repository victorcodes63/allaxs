import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/public-events-mode";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { setAuthCookies } from "@/lib/server/set-auth-cookies";
import { guestPaystackInitSchema } from "@/lib/validation/checkout";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(`guest-checkout:${ip}`)) {
      return NextResponse.json(
        { message: "Too many checkout attempts. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const raw = await request.json();
    const parsed = guestPaystackInitSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { message: first?.message ?? "Invalid checkout details" },
        { status: 400 },
      );
    }

    const body = parsed.data;
    if (!isUuid(body.eventId) || body.lines.some((l) => !isUuid(l.ticketTypeId))) {
      return NextResponse.json(
        {
          message:
            "This listing uses demo data. Browse /events for live events, or set NEXT_PUBLIC_USE_DEMO_EVENTS=false on deploy.",
        },
        { status: 400 },
      );
    }

    const API_URL = getServerApiBaseUrl();
    const response = await fetch(`${API_URL}/checkout/guest/paystack/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: body.eventId,
        lines: body.lines,
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        buyerPhone: body.buyerPhone || undefined,
        couponCode: body.couponCode,
        payInInstallments: body.payInInstallments,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to initialize payment" },
        { status: response.status },
      );
    }

    const tokens = extractAuthTokens(data);
    if (tokens.accessToken || tokens.refreshToken) {
      const cookieStore = await cookies();
      setAuthCookies(cookieStore, tokens);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Guest Paystack init proxy error:", error);
    return NextResponse.json({ message: "Unable to initialize payment" }, { status: 500 });
  }
}
