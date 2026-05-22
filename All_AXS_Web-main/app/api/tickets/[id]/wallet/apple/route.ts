import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/tickets/${id}/wallet/apple`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { message: data.message || "Apple Wallet pass unavailable" },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const filename = `allaxs-${id.slice(0, 8)}.pkpass`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Apple Wallet proxy error:", error);
    return NextResponse.json({ message: "Error loading Apple Wallet pass" }, { status: 500 });
  }
}
