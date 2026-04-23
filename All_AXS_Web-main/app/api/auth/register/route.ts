import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, name, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Registration failed" },
        { status: response.status }
      );
    }

    // Set cookies for tokens (auto-login after register)
    const { accessToken, refreshToken } = data.tokens || {};
    const cookieStore = await cookies();

    if (accessToken) {
      cookieStore.set("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 15 * 60, // 15 minutes
      });
    }

    if (refreshToken) {
      cookieStore.set("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 }
    );
  }
}

