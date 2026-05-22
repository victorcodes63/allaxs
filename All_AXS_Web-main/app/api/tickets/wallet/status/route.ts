import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/tickets/wallet/status`, {
      next: { revalidate: 60 },
    });

    const data = (await response.json().catch(() => ({}))) as {
      google?: boolean;
      apple?: boolean;
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          google: false,
          apple: false,
          message: data.message || "Wallet status unavailable",
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      google: Boolean(data.google),
      apple: Boolean(data.apple),
    });
  } catch (error) {
    console.error("Wallet status proxy error:", error);
    return NextResponse.json(
      { google: false, apple: false, message: "Wallet status unavailable" },
      { status: 503 },
    );
  }
}
