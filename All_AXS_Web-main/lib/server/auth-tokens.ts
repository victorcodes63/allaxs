/**
 * Normalize auth token payloads from Nest (camelCase vs snake_case, nested vs root).
 */
export function extractAuthTokens(data: unknown): {
  accessToken?: string;
  refreshToken?: string;
} {
  if (!data || typeof data !== "object") return {};

  const pick = (o: Record<string, unknown>) => ({
    accessToken:
      (typeof o.accessToken === "string" ? o.accessToken : undefined) ??
      (typeof o.access_token === "string" ? o.access_token : undefined),
    refreshToken:
      (typeof o.refreshToken === "string" ? o.refreshToken : undefined) ??
      (typeof o.refresh_token === "string" ? o.refresh_token : undefined),
  });

  const d = data as Record<string, unknown>;
  const nested = d.tokens;
  if (nested && typeof nested === "object") {
    const fromNested = pick(nested as Record<string, unknown>);
    if (fromNested.accessToken || fromNested.refreshToken) return fromNested;
  }
  return pick(d);
}
