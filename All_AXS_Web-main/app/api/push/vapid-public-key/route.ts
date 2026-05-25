import { NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

export async function GET() {
  try {
    const API_URL = getServerApiBaseUrl();
    const response = await fetch(`${API_URL}/push/vapid-public-key`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { publicKey: null, enabled: false, message: (data as { message?: string }).message },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Push VAPID proxy error:", error);
    return NextResponse.json({ publicKey: null, enabled: false }, { status: 500 });
  }
}
