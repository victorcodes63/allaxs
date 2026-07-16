/**
 * Normalize Nest-style HTTP exception bodies to a single user-facing string.
 */
export function formatUpstreamErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string" && m.trim()) return m;
  if (Array.isArray(m)) {
    const parts = m.map((x) => String(x)).filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  if (m && typeof m === "object") {
    const inner = (m as { message?: unknown }).message;
    if (typeof inner === "string" && inner.trim()) return inner;
  }
  if (typeof o.error === "string" && o.error.trim()) return o.error;
  return undefined;
}

export function extractUpstreamErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.code === "string" && o.code.trim()) return o.code;
  const m = o.message;
  if (m && typeof m === "object") {
    const code = (m as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return undefined;
}
