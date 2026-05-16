/**
 * Base URL for server-side Next.js routes that proxy to the Nest API.
 * Prefer API_URL; falls back to NEXT_PUBLIC_API_BASE_URL so local .env is easier.
 */
export function getServerApiBaseUrl(): string {
  const raw =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:8080";
  // Nest routes are /auth/*, /events/*, etc. The Vercel API project rewrites `/:path*`
  // → `/api/:path*`. If the base URL already ends with `/api`, calls like
  // `${base}/auth/login` become `/api/auth/login` on the host, which rewrites to
  // `/api/api/auth/...` and returns NOT_FOUND (404).
  return raw.replace(/\/$/, "").replace(/\/api\/?$/i, "");
}

export function upstreamUnreachableMessage(
  error: unknown,
  apiUrl: string,
): string | null {
  const codes = new Set([
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNRESET",
  ]);

  const fromErrno = (e: unknown): string | null => {
    if (!e || typeof e !== "object") return null;
    if ("code" in e && codes.has(String((e as NodeJS.ErrnoException).code))) {
      return `Cannot reach the API at ${apiUrl} (${String((e as NodeJS.ErrnoException).code)}). Start the Nest backend (e.g. \`npm run start:dev\` in All_AXS_Backend-main, default port 8080) or set API_URL / NEXT_PUBLIC_API_BASE_URL in .env.local.`;
    }
    if ("errors" in e && Array.isArray((e as AggregateError).errors)) {
      for (const sub of (e as AggregateError).errors) {
        const m = fromErrno(sub);
        if (m) return m;
      }
    }
    return null;
  };

  if (error instanceof TypeError && error.message === "fetch failed") {
    const cause = (error as TypeError & { cause?: unknown }).cause;
    const specific = fromErrno(cause) ?? fromErrno(error);
    if (specific) return specific;
    return `Cannot reach the API at ${apiUrl}. Start the Nest backend or set API_URL / NEXT_PUBLIC_API_BASE_URL in .env.local.`;
  }

  return fromErrno(error);
}
