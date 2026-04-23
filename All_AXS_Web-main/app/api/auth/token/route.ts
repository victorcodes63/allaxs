import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Minimal endpoint to get the access token for client-side API calls
 * This allows the client to make direct calls to the Nest API
 * while still using httpOnly cookies for secure token storage
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated", token: null },
        { status: 401 }
      );
    }

    // Return the token (client will use it to call Nest API directly)
    return NextResponse.json({ token: accessToken });
  } catch (error) {
    console.error("Get token error:", error);
    return NextResponse.json(
      { message: "Error retrieving token", token: null },
      { status: 500 }
    );
  }
}

