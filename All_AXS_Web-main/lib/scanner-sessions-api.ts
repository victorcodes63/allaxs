import axios from 'axios';
import { apiClient } from './api-client';

export interface OrganizerEventSummary {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
}

export async function listOrganizerEvents(): Promise<OrganizerEventSummary[]> {
  // Use the Next.js proxy route that already handles auth cookie forwarding
  const res = await axios.get<unknown>('/api/events');
  const data = res.data;
  if (Array.isArray(data)) return data as OrganizerEventSummary[];
  if (data && typeof data === 'object' && 'events' in data) {
    return (data as { events: OrganizerEventSummary[] }).events ?? [];
  }
  return [];
}

export interface ScannerSession {
  id: string;
  eventId: string;
  label: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  zoneScope: string | null;
  scanUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScannerSessionPayload {
  label: string;
  expiresAt: string;
  zoneScope?: string;
  volunteerEmail?: string;
}

export type SessionStatus = 'active' | 'expired' | 'revoked';

export function getSessionStatus(session: ScannerSession): SessionStatus {
  if (session.revokedAt) return 'revoked';
  if (new Date(session.expiresAt) < new Date()) return 'expired';
  return 'active';
}

export async function listScannerSessions(
  eventId: string,
): Promise<ScannerSession[]> {
  const res = await apiClient.get<ScannerSession[]>(
    `/organizer/events/${eventId}/scanner-sessions`,
  );
  return res.data;
}

export async function createScannerSession(
  eventId: string,
  payload: CreateScannerSessionPayload,
): Promise<ScannerSession> {
  const res = await apiClient.post<ScannerSession>(
    `/organizer/events/${eventId}/scanner-sessions`,
    payload,
  );
  return res.data;
}

export async function revokeScannerSession(
  eventId: string,
  sessionId: string,
): Promise<ScannerSession> {
  const res = await apiClient.delete<ScannerSession>(
    `/organizer/events/${eventId}/scanner-sessions/${sessionId}`,
  );
  return res.data;
}

export async function sendScannerInvite(
  eventId: string,
  sessionId: string,
  volunteerEmail: string,
): Promise<{ sent: boolean; to: string }> {
  const res = await apiClient.post<{ sent: boolean; to: string }>(
    `/organizer/events/${eventId}/scanner-sessions/${sessionId}/send-invite`,
    { volunteerEmail },
  );
  return res.data;
}
