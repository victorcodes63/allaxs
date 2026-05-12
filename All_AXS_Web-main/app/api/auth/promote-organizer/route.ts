import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { extractAuthTokens } from "@/lib/server/auth-tokens";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

export async function POST() {
  const API_URL = getServerApiBaseUrl();
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/auth/promote-organizer-demo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Promotion failed" },
        { status: response.status }
      );
    }

    const { accessToken: newAccess, refreshToken: newRefresh } =
      extractAuthTokens(data);

    if (newAccess) {
      cookieStore.set("accessToken", newAccess, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60,
      });
    }
    if (newRefresh) {
      cookieStore.set("refreshToken", newRefresh, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Promote organizer proxy error:", error);
    return NextResponse.json({ message: "Promotion failed" }, { status: 500 });
  }
}
