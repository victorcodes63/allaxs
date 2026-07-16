import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { normalizeWebUserRoles } from "@/lib/auth/hub-routing";
import { getServerApiBaseUrl } from "@/lib/server/api-url";
import { setAuthCookiesOnResponse } from "@/lib/server/auth-cookies";

type ApiUser = {
  id?: string;
  email?: string;
  name?: string;
  phone?: string | null;
  roles?: string[];
  status?: string;
  emailVerified?: boolean;
  hasPassword?: boolean;
  autoCreatedAt?: string | null;
  createdAt?: string;
  hasOrganizerProfile?: boolean;
};

function mapUser(raw: ApiUser | null | undefined) {
  if (!raw?.email && !raw?.id) return null;
  return {
    id: raw.id ?? "",
    email: raw.email ?? "",
    name: typeof raw.name === "string" ? raw.name : undefined,
    phone:
      typeof raw.phone === "string"
        ? raw.phone
        : raw.phone === null
          ? null
          : undefined,
    roles: normalizeWebUserRoles(raw.roles),
    status: raw.status,
    emailVerified:
      typeof raw.emailVerified === "boolean" ? raw.emailVerified : undefined,
    hasPassword:
      typeof raw.hasPassword === "boolean" ? raw.hasPassword : undefined,
    autoCreatedAt:
      typeof raw.autoCreatedAt === "string" ? raw.autoCreatedAt : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    hasOrganizerProfile:
      typeof raw.hasOrganizerProfile === "boolean" ? raw.hasOrganizerProfile : undefined,
  };
}

async function readAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function GET() {
  const API_URL = getServerApiBaseUrl();
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      user?: ApiUser;
      message?: string;
    };
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || "Unable to load profile" },
        { status: response.status },
      );
    }
    const user = mapUser(data.user);
    if (!user) {
      return NextResponse.json({ message: "Invalid profile response" }, { status: 502 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const API_URL = getServerApiBaseUrl();
  try {
    const accessToken = await readAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const response = await fetch(`${API_URL}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      user?: ApiUser;
      tokens?: { accessToken: string; refreshToken: string };
      message?: string | string[];
    };
    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Unable to update profile";
      return NextResponse.json({ message }, { status: response.status });
    }

    const user = mapUser(data.user);
    const next = NextResponse.json({ user });
    if (data.tokens?.accessToken && data.tokens?.refreshToken) {
      setAuthCookiesOnResponse(next, data.tokens);
    }
    return next;
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}
