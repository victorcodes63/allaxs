import axios from "axios";

/** Shared in-flight refresh so proxy + AuthProvider + tabs do not rotate twice. */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * POST `/api/auth/refresh` at most once at a time per tab.
 * Returns true when new cookies were minted, false when refresh failed.
 */
export async function refreshSessionOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await axios.post("/api/auth/refresh");
      return response.status === 200;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Clear httpOnly cookies and reset client auth state after a dead session. */
export async function clearClientSession(): Promise<void> {
  try {
    await axios.post("/api/auth/logout");
  } catch {
    /* cookies may already be cleared at the edge */
  }
}
