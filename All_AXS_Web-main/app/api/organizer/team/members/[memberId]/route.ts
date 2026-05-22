import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  try {
    const { memberId } = await context.params;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/organizers/team/members/${memberId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(
      { message: `Failed to remove member (${response.status})` },
      { status: response.status },
    );
  } catch (error) {
    console.error("Organizer team remove member proxy error:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Error removing member" },
      { status: 500 },
    );
  }
}
