/** Nest returns 404 + "Cannot GET|POST /path" when the route is missing from the serverless bundle. */
export function nestRouteMissing(
  status: number,
  data: unknown,
  pathNeedle: string,
): boolean {
  if (status !== 404 || !data || typeof data !== "object") return false;
  const m = (data as { message?: unknown }).message;
  const s = typeof m === "string" ? m : JSON.stringify(m);
  return /\bCannot (GET|POST|PUT|PATCH|DELETE)\b/.test(s) && s.includes(pathNeedle);
}
