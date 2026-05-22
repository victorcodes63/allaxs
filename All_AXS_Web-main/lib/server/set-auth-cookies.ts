import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

export function setAuthCookies(
  cookieStore: ResponseCookies,
  tokens: { accessToken?: string; refreshToken?: string },
) {
  if (tokens.accessToken) {
    cookieStore.set("accessToken", tokens.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60,
    });
  }
  if (tokens.refreshToken) {
    cookieStore.set("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
}
