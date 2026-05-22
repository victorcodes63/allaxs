/// <reference types="vite/client" />
import { normalizeVolunteerScanPayload } from './ticket-qr';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

export type ValidateResult =
  | { valid: true; firstName: string; tier: string }
  | { valid: false; reason: string };

export type SessionInfo = {
  label: string;
  eventTitle: string;
  expiresAt: string;
};

export async function fetchSessionInfo(token: string): Promise<SessionInfo> {
  const res = await fetch(`${API_BASE}/scan/session-info`, {
    headers: { 'X-Scanner-Token': token },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    throw new Error(body.reason ?? 'EXPIRED_SESSION');
  }
  return res.json() as Promise<SessionInfo>;
}

export async function validateQr(
  token: string,
  rawQrData: string,
): Promise<ValidateResult> {
  const qrPayload = normalizeVolunteerScanPayload(rawQrData);
  if (!qrPayload) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  const res = await fetch(`${API_BASE}/scan/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Scanner-Token': token,
    },
    body: JSON.stringify({ qrPayload }),
  });

  if (!res.ok && res.status === 401) {
    return { valid: false, reason: 'EXPIRED_SESSION' };
  }

  if (!res.ok) {
    throw new Error('NETWORK_ERROR');
  }

  return res.json() as Promise<ValidateResult>;
}
