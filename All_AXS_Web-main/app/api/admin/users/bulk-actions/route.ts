import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/lib/server/api-url";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function POST(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${API_URL}/admin/users/bulk-actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
