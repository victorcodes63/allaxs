import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "Refresh token not found" },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Token refresh failed" },
        { status: response.status }
      );
    }

    // Set updated cookies
    const { accessToken, refreshToken: newRefreshToken } = data.tokens || {};

    if (accessToken) {
      cookieStore.set("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });
    }

    if (newRefreshToken) {
      cookieStore.set("refreshToken", newRefreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { message: "An error occurred during token refresh" },
      { status: 500 }
    );
  }
}

