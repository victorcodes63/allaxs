const SESSION_TOKEN_RE = /^[a-f0-9]{64}$/i;

function isSessionToken(value: string | null | undefined): value is string {
  return !!value && SESSION_TOKEN_RE.test(value);
}

/**
 * Extracts the volunteer scanner session token from the URL.
 * Supports:
 *   - Path route:   /s/<token>          (production links from the API)
 *   - Hash route:   /#/s/<token>        or   #/s/<token>
 *   - Query param:  ?session=<token>
 * Returns null if not found.
 */
export function extractToken(): string | null {
  const pathMatch = /^\/s\/([a-f0-9]{64})\/?$/i.exec(window.location.pathname);
  if (isSessionToken(pathMatch?.[1])) return pathMatch[1];

  const hash = window.location.hash.replace(/^#\/?/, '');
  const hashMatch = /^s\/([a-f0-9]{64})$/i.exec(hash);
  if (isSessionToken(hashMatch?.[1])) return hashMatch[1];

  const params = new URLSearchParams(window.location.search);
  const qp = params.get('session');
  if (isSessionToken(qp)) return qp;

  return null;
}
