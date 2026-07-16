import { NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { buildAdminOverviewFallback } from "@/lib/server/admin-overview-fallback";
import { nestRouteMissing } from "@/lib/server/nest-route-missing";
import {
  refreshSessionAccessForced,
  resolveSessionAccess,
} from "@/lib/server/session-access";

async function fetchOverview(apiUrl: string, accessToken: string) {
  return fetch(`${apiUrl}/admin/overview`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

export async function GET() {
  const API_URL = getServerApiBaseUrl();
  try {
    let session = await resolveSessionAccess();
    if (!session.accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      );
    }

    let response = await fetchOverview(API_URL, session.accessToken);

    if (response.status === 401) {
      session = await refreshSessionAccessForced();
      if (!session.accessToken) {
        return NextResponse.json(
          { message: "Not authenticated" },
          { status: 401 },
        );
      }
      response = await fetchOverview(API_URL, session.accessToken);
    }

    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      return session.applyRotatedCookies(
        NextResponse.json(
          {
            message: `Backend returned non-JSON response (${response.status})`,
            preview: text.slice(0, 200),
          },
          { status: response.status || 500 },
        ),
      );
    }

    if (!response.ok) {
      if (
        nestRouteMissing(response.status, data, "/admin/overview") &&
        session.accessToken
      ) {
        try {
          const synthesized = await buildAdminOverviewFallback(
            API_URL,
            session.accessToken,
          );
          return session.applyRotatedCookies(NextResponse.json(synthesized));
        } catch (fallbackErr) {
          console.error("Admin overview fallback failed:", fallbackErr);
          return session.applyRotatedCookies(
            NextResponse.json(
              {
                message:
                  (fallbackErr as Error).message ||
                  "Admin overview fallback failed",
              },
              { status: 502 },
            ),
          );
        }
      }

      return session.applyRotatedCookies(
        NextResponse.json(data, { status: response.status }),
      );
    }

    return session.applyRotatedCookies(NextResponse.json(data));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          "An error occurred while loading the admin overview",
      },
      { status: 500 },
    );
  }
}
