import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await context.params;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const endpoint = `${API_URL}/organizers/sales/events/${encodeURIComponent(eventId)}/attendees/export`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return NextResponse.json(
          {
            message:
              (data as { message?: string })?.message ||
              `Failed to export attendees (${response.status})`,
          },
          { status: response.status },
        );
      }
      const text = await response.text();
      console.error("Organizer attendees export error:", text.substring(0, 200));
      return NextResponse.json(
        { message: `Failed to export attendees (${response.status})` },
        { status: response.status },
      );
    }

    const csv = await response.text();
    const disposition = response.headers.get("content-disposition");
    const headers = new Headers();
    headers.set("Content-Type", "text/csv; charset=utf-8");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    } else {
      headers.set("Content-Disposition", `attachment; filename="attendees-${eventId}.csv"`);
    }

    return new NextResponse(csv, { status: 200, headers });
  } catch (error) {
    console.error("Organizer attendees export proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error exporting attendees" },
      { status: 500 },
    );
  }
}
