import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Helper to decode JWT without verification (just to check exp)
// Uses Buffer which is available in Next.js Edge runtime
function decodeJWT(token: string): { exp?: number } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;

  // Check if token exists
  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Optionally check if token is expired
  const decoded = decodeJWT(accessToken);
  if (decoded?.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      // Token expired, redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/organizer/:path*",
    "/admin/:path*",
    "/account/:path*",
    /* Checkout requires an account so the demo matches signup → pay → ticket */
    "/events/:eventId/checkout",
    /* /tickets stays public so session-stored passes work after checkout */
  ],
};

