import type { NextResponse } from "next/server";

const CLEAR_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 0,
};

/** Remove stale httpOnly auth cookies from a redirect or pass-through response. */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set("accessToken", "", CLEAR_COOKIE);
  response.cookies.set("refreshToken", "", CLEAR_COOKIE);
  return response;
}
