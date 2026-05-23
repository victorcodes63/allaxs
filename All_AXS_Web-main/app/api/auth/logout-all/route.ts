import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set("accessToken", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("refreshToken", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/auth/logout-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status !== 204) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: (data as { message?: string }).message || "Unable to sign out everywhere" },
        { status: response.status },
      );
    }

    const next = NextResponse.json({ signedOutAll: true });
    clearAuthCookies(next);
    return next;
  } catch (error) {
    console.error("Logout-all proxy error:", error);
    return NextResponse.json({ message: "Error signing out everywhere" }, { status: 500 });
  }
}
