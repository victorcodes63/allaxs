/**
 * Web OAuth client ID for @react-oauth/google (`GoogleLogin`).
 * Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` (dev) or Vercel env (prod).
 * Must match the audience your Nest API verifies (`GOOGLE_CLIENT_ID` on the API).
 */
export function getGoogleOAuthWebClientId(): string | undefined {
  const v = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export function isGoogleOAuthWebClientConfigured(): boolean {
  return getGoogleOAuthWebClientId() !== undefined;
}
