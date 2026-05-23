import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

type ApiPrefs = {
  ordersEmail?: boolean;
  marketingEmail?: boolean;
  reminders?: boolean;
};

function mapPrefs(raw: ApiPrefs | null | undefined) {
  return {
    ordersEmail: raw?.ordersEmail !== false,
    marketingEmail: raw?.marketingEmail === true,
    reminders: raw?.reminders !== false,
  };
}

async function readAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET() {
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/auth/notification-preferences`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      preferences?: ApiPrefs;
      message?: string;
    };
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to load notification preferences" },
        { status: response.status },
      );
    }
    return NextResponse.json({ preferences: mapPrefs(data.preferences) });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const response = await fetch(`${API_URL}/auth/notification-preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      preferences?: ApiPrefs;
      message?: string | string[];
    };
    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Unable to update notification preferences";
      return NextResponse.json({ message }, { status: response.status });
    }
    return NextResponse.json({ preferences: mapPrefs(data.preferences) });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}
