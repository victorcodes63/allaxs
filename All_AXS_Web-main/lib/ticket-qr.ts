import type { StoredTicket } from "@/lib/checkout-storage";
import { getPublicSiteOrigin } from "@/lib/site-url";

/** Path prefix for camera-friendly ticket verification URLs. */
export const TICKET_VERIFY_PATH = "/v";

export type TicketQrScanPayloadV2 = {
  v: 2;
  ticketId: string;
  qrNonce: string;
  qrSignature: string;
};

export type TicketQrScanPayloadV1 = {
  v: 1;
  app: "allaxs";
  demo: true;
  ticketId: string;
  orderId: string;
  eventSlug: string;
  eventTitle: string;
  tier: string;
  attendeeEmail: string;
  issuedAt: string;
};

/** Compact token embedded in `/v/{token}` (base64url JSON). */
type CompactVerifyToken = {
  v: 1 | 2;
  id: string;
  n?: string;
  s?: string;
  d?: 1;
  et?: string;
  tn?: string;
  es?: string;
  o?: string;
  ae?: string;
  ia?: string;
};

export type DecodedTicketVerify = {
  version: 1 | 2;
  ticketId: string;
  isDemo: boolean;
  eventTitle: string | null;
  tierName: string | null;
  eventSlug: string | null;
  scanPayload: string;
};

function utf8ToBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(
          Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
        );
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(token: string): string | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const normalized = padded + "=".repeat(padLen);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf8");
    }
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function compactFromTicket(ticket: StoredTicket): CompactVerifyToken {
  if (ticket.qrNonce && ticket.qrSignature) {
    return {
      v: 2,
      id: ticket.id,
      n: ticket.qrNonce,
      s: ticket.qrSignature,
    };
  }
  return {
    v: 1,
    id: ticket.id,
    d: 1,
    et: ticket.eventTitle,
    tn: ticket.tierName,
    es: ticket.eventSlug,
    o: ticket.orderId,
    ae: ticket.attendeeEmail,
    ia: ticket.issuedAt,
  };
}

function scanPayloadFromCompact(token: CompactVerifyToken): string | null {
  if (token.v === 2 && token.n && token.s) {
    const payload: TicketQrScanPayloadV2 = {
      v: 2,
      ticketId: token.id,
      qrNonce: token.n,
      qrSignature: token.s,
    };
    return JSON.stringify(payload);
  }
  if (token.v === 1 && token.d === 1) {
    const payload: TicketQrScanPayloadV1 = {
      v: 1,
      app: "allaxs",
      demo: true,
      ticketId: token.id,
      orderId: token.o ?? "",
      eventSlug: token.es ?? "",
      eventTitle: token.et ?? "Event",
      tier: token.tn ?? "Ticket",
      attendeeEmail: token.ae ?? "",
      issuedAt: token.ia ?? new Date(0).toISOString(),
    };
    return JSON.stringify(payload);
  }
  return null;
}

function normalizeLegacyJsonPayload(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.v === 2 && typeof parsed.ticketId === "string") {
      const payload: TicketQrScanPayloadV2 = {
        v: 2,
        ticketId: parsed.ticketId,
        qrNonce: String(parsed.qrNonce ?? ""),
        qrSignature: String(parsed.qrSignature ?? ""),
      };
      if (!payload.qrNonce || !payload.qrSignature) return null;
      return JSON.stringify(payload);
    }
    if (parsed.v === 1 && parsed.demo === true && typeof parsed.ticketId === "string") {
      return JSON.stringify(parsed);
    }
    if (typeof parsed.ticketId === "string" && parsed.qrNonce && parsed.qrSignature) {
      return JSON.stringify({
        v: 2,
        ticketId: parsed.ticketId,
        qrNonce: String(parsed.qrNonce),
        qrSignature: String(parsed.qrSignature),
      });
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeTicketVerifyToken(ticket: StoredTicket): string {
  return utf8ToBase64Url(JSON.stringify(compactFromTicket(ticket)));
}

export function decodeTicketVerifyToken(token: string): DecodedTicketVerify | null {
  const json = base64UrlToUtf8(token.trim());
  if (!json) return null;
  let compact: CompactVerifyToken;
  try {
    compact = JSON.parse(json) as CompactVerifyToken;
  } catch {
    return null;
  }
  if (!compact?.id || (compact.v !== 1 && compact.v !== 2)) return null;

  const scanPayload = scanPayloadFromCompact(compact);
  if (!scanPayload) return null;

  return {
    version: compact.v,
    ticketId: compact.id,
    isDemo: compact.v === 1 && compact.d === 1,
    eventTitle: compact.et ?? null,
    tierName: compact.tn ?? null,
    eventSlug: compact.es ?? null,
    scanPayload,
  };
}

/**
 * JSON body sent to `POST .../tickets/scan` (legacy QR format; still supported).
 */
export function buildTicketQrScanPayload(ticket: StoredTicket): string {
  if (ticket.qrNonce && ticket.qrSignature) {
    return JSON.stringify({
      v: 2,
      ticketId: ticket.id,
      qrNonce: ticket.qrNonce,
      qrSignature: ticket.qrSignature,
    } satisfies TicketQrScanPayloadV2);
  }
  return JSON.stringify({
    v: 1,
    app: "allaxs",
    demo: true,
    ticketId: ticket.id,
    orderId: ticket.orderId,
    eventSlug: ticket.eventSlug,
    eventTitle: ticket.eventTitle,
    tier: ticket.tierName,
    attendeeEmail: ticket.attendeeEmail,
    issuedAt: ticket.issuedAt,
  } satisfies TicketQrScanPayloadV1);
}

/** @deprecated Prefer {@link buildTicketQrUrl} for on-screen / PDF QR codes. */
export function buildTicketQrPayload(ticket: StoredTicket): string {
  return buildTicketQrScanPayload(ticket);
}

export function buildTicketVerifyPath(ticket: StoredTicket): string {
  return `${TICKET_VERIFY_PATH}/${encodeTicketVerifyToken(ticket)}`;
}

/**
 * HTTPS URL encoded in ticket QR codes (opens in phone cameras → `/v/...` landing).
 */
export function buildTicketQrUrl(origin: string, ticket: StoredTicket): string {
  const base = (origin || getPublicSiteOrigin()).replace(/\/$/, "");
  return `${base}${buildTicketVerifyPath(ticket)}`;
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

  if (/^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !trimmed.startsWith("{")) {
    return trimmed;
  }

  return null;
}

/**
 * Normalizes scanner input (URL, bare token, or legacy JSON) to the JSON scan payload.
 */
export function normalizeScannedTicketPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    return normalizeLegacyJsonPayload(trimmed);
  }

  const token = extractTokenFromVerifyUrl(trimmed);
  if (token) {
    const decoded = decodeTicketVerifyToken(token);
    if (decoded) return decoded.scanPayload;
  }

  return null;
}

export function compactTicketRef(ticketId: string): string {
  return ticketId.startsWith("tk_") ? ticketId.slice(3, 11).toUpperCase() : ticketId.slice(0, 8).toUpperCase();
}
