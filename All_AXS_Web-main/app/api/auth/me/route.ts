import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeWebUserRoles } from "@/lib/auth/hub-routing";

// Helper to decode JWT payload without verification (just to get user info)
function decodeJWT(token: string): { sub?: string; id?: string; email?: string; name?: string; roles?: string[]; exp?: number } | null {
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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    // Decode the JWT to get user info from the token itself
    // This avoids making an unnecessary API call right after login
    const decoded = decodeJWT(accessToken);
    
    if (!decoded || !decoded.email) {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp < now) {
        return NextResponse.json(
          { message: "Token expired" },
          { status: 401 }
        );
      }
    }

    // Return user info from token (roles normalized for web hub + guards)
    return NextResponse.json({
      user: {
        id: decoded.sub || decoded.id || "",
        email: decoded.email || "",
        name: decoded.name,
        roles: normalizeWebUserRoles((decoded as Record<string, unknown>).roles),
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { message: "An error occurred" },
      { status: 500 }
    );
  }
}

