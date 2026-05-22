/** Path prefix for ticket verification URLs (e.g. https://www.axs.africa/v/...). */
export const TICKET_VERIFY_PATH = '/v';

type CompactVerifyToken = {
  v: 1 | 2;
  id: string;
  n?: string;
  s?: string;
  d?: 1;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64UrlToUtf8(token: string): string | null {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const normalized = padded + '='.repeat(padLen);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeVerifyToken(token: string): CompactVerifyToken | null {
  const json = base64UrlToUtf8(token.trim());
  if (!json) return null;
  try {
    const compact = JSON.parse(json) as CompactVerifyToken;
    if (!compact?.id || (compact.v !== 1 && compact.v !== 2)) return null;
    return compact;
  } catch {
    return null;
  }
}

export function extractTokenFromVerifyUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(new RegExp(`^${TICKET_VERIFY_PATH}/([^/]+)$`));
    if (match?.[1]) return match[1];
  } catch {
    /* not a full URL */
  }

  const pathMatch = trimmed.match(new RegExp(`${TICKET_VERIFY_PATH}/([A-Za-z0-9_-]+)`));
  if (pathMatch?.[1]) return pathMatch[1];

  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !trimmed.startsWith('{')) {
    return trimmed;
  }

  return null;
}

function parseJsonScanPayload(raw: string): { ticketId: string; qrNonce: string } | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.v === 2 && typeof parsed.ticketId === 'string') {
      const ticketId = parsed.ticketId;
      const qrNonce = String(parsed.qrNonce ?? '');
      if (!UUID_RE.test(ticketId) || !qrNonce) return null;
      return { ticketId, qrNonce };
    }
    if (typeof parsed.ticketId === 'string' && parsed.qrNonce) {
      const ticketId = parsed.ticketId;
      const qrNonce = String(parsed.qrNonce);
      if (!UUID_RE.test(ticketId) || !qrNonce) return null;
      return { ticketId, qrNonce };
    }
    return null;
  } catch {
    return null;
  }
}

function parseColonScanPayload(raw: string): { ticketId: string; qrNonce: string } | null {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(.+)$/i.exec(
    raw.trim(),
  );
  if (!match?.[1] || !match[2]) return null;
  return { ticketId: match[1], qrNonce: match[2] };
}

function parseVerifyUrlPayload(raw: string): { ticketId: string; qrNonce: string } | null {
  const token = extractTokenFromVerifyUrl(raw);
  if (!token) return null;

  const compact = decodeVerifyToken(token);
  if (!compact || compact.v !== 2 || !compact.n) return null;
  if (!UUID_RE.test(compact.id)) return null;

  return { ticketId: compact.id, qrNonce: compact.n };
}

/**
 * Normalizes camera/USB scanner input to `ticketId:qrNonce` for POST /scan/validate.
 * Accepts verify URLs (https://www.axs.africa/v/...), legacy JSON, or ticketId:qrNonce.
 */
export function normalizeVolunteerScanPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed =
    (trimmed.startsWith('{') ? parseJsonScanPayload(trimmed) : null) ??
    parseVerifyUrlPayload(trimmed) ??
    parseColonScanPayload(trimmed);

  if (!parsed) return null;
  return `${parsed.ticketId}:${parsed.qrNonce}`;
}
