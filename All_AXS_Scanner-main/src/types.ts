export type InvalidReason =
  | 'ALREADY_SCANNED'
  | 'WRONG_EVENT'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_SESSION'
  | 'TICKET_VOID'
  | 'NETWORK_ERROR';

export type AppState =
  | { screen: 'LOADING_SESSION' }
  | { screen: 'READY'; sessionLabel: string; eventTitle: string }
  | { screen: 'RESULT_VALID'; firstName: string; tier: string }
  | { screen: 'RESULT_INVALID'; reason: InvalidReason }
  | { screen: 'ERROR'; message: string };

export type AppAction =
  | { type: 'SESSION_LOADED'; sessionLabel: string; eventTitle: string }
  | { type: 'SESSION_ERROR'; message: string }
  | { type: 'SCAN_VALID'; firstName: string; tier: string }
  | { type: 'SCAN_INVALID'; reason: InvalidReason }
  | { type: 'RESET' };

export const REASON_LABEL: Record<InvalidReason, string> = {
  ALREADY_SCANNED: 'Already Scanned',
  WRONG_EVENT: 'Wrong Event',
  INVALID_SIGNATURE: 'Invalid Ticket',
  TICKET_VOID: 'Void Ticket',
  EXPIRED_SESSION: 'Scanner Session Expired',
  NETWORK_ERROR: 'Network Error — Try Again',
};
