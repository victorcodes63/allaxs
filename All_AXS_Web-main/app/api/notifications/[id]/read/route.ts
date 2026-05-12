import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { nestRouteMissing } from "@/lib/server/nest-route-missing";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    const API_URL = getServerApiBaseUrl();
    const endpoint = `${API_URL}/notifications/${encodeURIComponent(id)}/read`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? await response.json()
      : { message: "Unexpected response format" };

    if (!response.ok) {
      if (nestRouteMissing(response.status, data, `/notifications/${id}/read`)) {
        return NextResponse.json({
          notification: {
            id,
            title: "",
            body: "",
            createdAt: new Date().toISOString(),
            category: "system",
            channel: "PUSH",
            status: "SENT",
            isRead: true,
          },
        });
      }
      return NextResponse.json(
        {
          message:
            (data as { message?: string })?.message ||
            `Failed to mark notification as read (${response.status})`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Notification read proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error marking notification as read" },
      { status: 500 },
    );
  }
}
