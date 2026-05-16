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

function accessTokenNeedsRotation(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  const decoded = decodeJWT(accessToken);
  if (!decoded?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

function forwardSetCookies(from: Response, to: NextResponse) {
  const headersWithGetSetCookie = from.headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    for (const cookie of headersWithGetSetCookie.getSetCookie()) {
      to.headers.append("Set-Cookie", cookie);
    }
    return;
  }
  const joined = from.headers.get("set-cookie");
  if (joined) {
    to.headers.append("Set-Cookie", joined);
  }
}

function isAuthEntryPath(pathname: string): boolean {
  const authPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
  ] as const;
  return authPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * When the access JWT is missing or past `exp`, renew it using the httpOnly refresh cookie
 * so users stay signed in until they hit logout (refresh cookie lifetime).
 */
async function tryRefreshAndContinue(request: NextRequest): Promise<NextResponse | null> {
  const refreshToken = request.cookies.get("refreshToken")?.value;
  if (!refreshToken) return null;

  const refreshUrl = new URL("/api/auth/refresh", request.url);
  let refreshRes: Response;
  try {
    refreshRes = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
      },
    });
  } catch {
    return null;
  }

  if (!refreshRes.ok) return null;

  const res = NextResponse.next();
  forwardSetCookies(refreshRes, res);
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;

  if (isAuthEntryPath(pathname)) {
    // Let the auth page load even when a session cookie exists. Client-side
    // `useReplaceIfAuthenticated` uses role-aware routing (e.g. `/admin` for
    // admins). A hard edge redirect to `/dashboard` here bypassed that and
    // trapped every signed-in user on the attendee hub.
    if (!accessTokenNeedsRotation(accessToken)) {
      return NextResponse.next();
    }

    const renewed = await tryRefreshAndContinue(request);
    if (renewed) {
      return renewed;
    }

    return NextResponse.next();
  }

  if (accessTokenNeedsRotation(accessToken)) {
    const renewed = await tryRefreshAndContinue(request);
    if (renewed) return renewed;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    if (pathname.startsWith("/organizer")) {
      loginUrl.searchParams.set("intent", "host");
    } else if (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/tickets" ||
      pathname.startsWith("/tickets/") ||
      pathname === "/notifications" ||
      pathname.startsWith("/notifications/")
    ) {
      loginUrl.searchParams.set("intent", "attend");
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
    "/dashboard/:path*",
    "/organizer/:path*",
    "/admin/:path*",
    "/account/:path*",
    /* Public checkout URL: buyers sign in or register before Paystack; /tickets stays public for session passes. */
  ],
};
