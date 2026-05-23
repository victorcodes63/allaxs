import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decodeAccessTokenPayload,
} from "@/lib/auth/jwt-payload";
import {
  isGuestOnlyPublicPath,
  isPublicBrowseActive,
  PUBLIC_BROWSE_COOKIE,
  resolveGuestOnlyPublicRedirect,
} from "@/lib/auth/guest-only-public-routes";

// Helper to decode JWT without verification (just to check exp)
function decodeJWT(token: string): { exp?: number } | null {
  return decodeAccessTokenPayload(token);
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
    "/check-email",
    "/resend-verification",
  ] as const;
  return authPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedAppPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/organizer" ||
    pathname.startsWith("/organizer/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/")
  );
}

function redirectSignedInFromGuestPublic(
  request: NextRequest,
  pathname: string,
  accessToken: string,
): NextResponse {
  const decoded = decodeAccessTokenPayload(accessToken);
  const target = resolveGuestOnlyPublicRedirect(
    pathname,
    request.nextUrl.search,
    decoded?.roles ?? [],
  );
  return NextResponse.redirect(new URL(target, request.url));
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

function attachPublicBrowseCookie(response: NextResponse): NextResponse {
  response.cookies.set(PUBLIC_BROWSE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 4,
  });
  return response;
}

function clearPublicBrowseCookie(response: NextResponse): NextResponse {
  response.cookies.delete(PUBLIC_BROWSE_COOKIE);
  return response;
}

export async function proxy(request: NextRequest) {
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

  if (isGuestOnlyPublicPath(pathname)) {
    if (isPublicBrowseActive(request.nextUrl.searchParams, request.cookies)) {
      return attachPublicBrowseCookie(NextResponse.next());
    }

    if (accessToken && !accessTokenNeedsRotation(accessToken)) {
      return redirectSignedInFromGuestPublic(request, pathname, accessToken);
    }

    if (accessTokenNeedsRotation(accessToken)) {
      const renewed = await tryRefreshAndContinue(request);
      if (renewed) {
        return renewed;
      }
    }

    return NextResponse.next();
  }

  if (isProtectedAppPath(pathname)) {
    if (accessTokenNeedsRotation(accessToken)) {
      const renewed = await tryRefreshAndContinue(request);
      if (renewed) {
        return clearPublicBrowseCookie(renewed);
      }

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
      return clearPublicBrowseCookie(NextResponse.redirect(loginUrl));
    }

    return clearPublicBrowseCookie(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/events",
    "/events/:path*",
    "/organizers",
    "/organizers/:path*",
    "/e/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/resend-verification",
    "/dashboard/:path*",
    "/organizer/:path*",
    "/admin/:path*",
    "/account/:path*",
    /* Public checkout: guest flow (no sign-in); /tickets stays public for session passes. */
  ],
};
