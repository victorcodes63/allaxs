import axios from "axios";

/** Shared in-flight refresh so proxy + AuthProvider + tabs do not rotate twice. */
let refreshInFlight: Promise<boolean> | null = null;

const REFRESH_RETRY_DELAYS_MS = [400, 900];

function isRefreshConcurrentError(err: unknown): boolean {
  const response = (err as { response?: { status?: number; data?: { code?: string } } })
    .response;
  if (response?.status === 409) return true;
  return response?.data?.code === "refreshConcurrent";
}

/**
 * POST `/api/auth/refresh` at most once at a time per tab.
 * Returns true when new cookies were minted, false when refresh failed.
 */
export async function refreshSessionOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt++) {
        try {
          const response = await axios.post("/api/auth/refresh");
          return response.status === 200;
        } catch (err) {
          if (
            isRefreshConcurrentError(err) &&
            attempt < REFRESH_RETRY_DELAYS_MS.length
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, REFRESH_RETRY_DELAYS_MS[attempt]),
            );
            continue;
          }
          return false;
        }
      }
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Clear httpOnly cookies via logout. Only call from explicit sign-out flows. */
export async function clearClientSession(): Promise<void> {
  try {
    await axios.post("/api/auth/logout");
  } catch {
    /* cookies may already be cleared at the edge */
  }
}
