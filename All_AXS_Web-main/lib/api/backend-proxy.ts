/**
 * Shared helper for Next.js Route Handlers that simply forward an authenticated
 * request to the NestJS backend. Keeps the per-route boilerplate small so we
 * can add new organizer surfaces (payouts, customers, waitlist, refunds,
 * marketing, store, affiliates) without copy-pasting a 100-line block each
 * time.
 *
 * Usage:
 *
 *   export const GET = makeBackendProxy({ method: "GET", path: "organizers/payouts/summary" });
 *
 *   // dynamic path
 *   export const POST = makeBackendProxyDynamic<{ id: string }>(({ id }) => ({
 *     method: "POST",
 *     path: `events/${id}/publish`,
 *   }));
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const BACKEND_API_URL = process.env.API_URL || "http://localhost:8080";

async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("accessToken")?.value;
}

export async function readJsonOrError(
  response: Response,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    return { ok: true, data };
  }
  // Some endpoints (CSV exports etc.) may return non-JSON. Pass through 204 / empty.
  if (response.status === 204) {
    return { ok: true, data: null };
  }
  const text = await response.text();
  return {
    ok: false,
    response: NextResponse.json(
      {
        message: `Backend endpoint returned non-JSON response (${response.status})`,
        body: text.slice(0, 200),
      },
      { status: response.status || 500 },
    ),
  };
}

export interface ProxyOptions {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Path on the backend, no leading slash (e.g. "organizers/payouts/summary"). */
  path: string;
  /** Whether to forward the request body (default: true for POST/PATCH/PUT). */
  forwardBody?: boolean;
  /**
   * Whether to forward request `searchParams` to the backend URL.
   * Defaults to `true` for GET requests.
   */
  forwardQuery?: boolean;
  /** Extra headers to merge in. */
  extraHeaders?: Record<string, string>;
  /** Friendly fallback message used if the backend returns an unexpected error. */
  errorMessage?: string;
}

export async function callBackend(
  request: NextRequest | null,
  options: ProxyOptions,
): Promise<NextResponse> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.extraHeaders ?? {}),
    };

    let url = `${BACKEND_API_URL}/${options.path.replace(/^\//, "")}`;
    const forwardQuery =
      options.forwardQuery ?? (options.method === "GET" || options.method === "DELETE");
    if (forwardQuery && request) {
      const incoming = new URL(request.url).searchParams;
      const qs = incoming.toString();
      if (qs) {
        url += url.includes("?") ? `&${qs}` : `?${qs}`;
      }
    }

    const init: RequestInit = { method: options.method, headers };
    const forwardBody =
      options.forwardBody ??
      ["POST", "PATCH", "PUT"].includes(options.method);

    if (forwardBody && request) {
      try {
        const body = await request.text();
        if (body) init.body = body;
      } catch {
        // No body — that's fine.
      }
    }

    const response = await fetch(url, init);

    const parsed = await readJsonOrError(response);
    if (!parsed.ok) return parsed.response;

    if (!response.ok) {
      const message =
        (parsed.data as { message?: string } | null)?.message ??
        options.errorMessage ??
        `Request failed (${response.status})`;
      const out =
        parsed.data && typeof parsed.data === "object"
          ? parsed.data
          : { message };
      return NextResponse.json(out, { status: response.status });
    }

    return NextResponse.json(parsed.data ?? {});
  } catch (error) {
    const message =
      (error as Error).message ||
      options.errorMessage ||
      "Request failed";
    console.error(`Backend proxy error [${options.method} ${options.path}]:`, message);
    return NextResponse.json({ message }, { status: 500 });
  }
}

/** Static-path route helper. */
export function makeBackendProxy(options: ProxyOptions) {
  return async function handler(request: NextRequest): Promise<NextResponse> {
    return callBackend(request, options);
  };
}

/** Dynamic-path helper for routes with `[id]`/`[slug]` etc. */
export function makeBackendProxyDynamic<TParams extends Record<string, string>>(
  build: (params: TParams) => ProxyOptions,
) {
  return async function handler(
    request: NextRequest,
    ctx: { params: Promise<TParams> },
  ): Promise<NextResponse> {
    const params = await ctx.params;
    return callBackend(request, build(params));
  };
}
