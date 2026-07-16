import type { NextResponse } from "next/server";

const BASE_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Attach fresh httpOnly auth cookies to a Route Handler response. */
export function setAuthCookiesOnResponse(
  response: NextResponse,
  tokens: { accessToken?: string; refreshToken?: string },
): NextResponse {
  if (tokens.accessToken) {
    response.cookies.set("accessToken", tokens.accessToken, {
      ...BASE_COOKIE,
      maxAge: 15 * 60,
    });
  }
  if (tokens.refreshToken) {
    response.cookies.set("refreshToken", tokens.refreshToken, {
      ...BASE_COOKIE,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}
