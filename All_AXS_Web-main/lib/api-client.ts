/**
 * Shared API client for making direct calls to the NestJS backend
 * Uses NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8080)
 */

import axios, { AxiosInstance, AxiosError } from "axios";

// Get API base URL from environment variable
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

// Token cache (in-memory, cleared on page refresh)
let tokenCache: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

/**
 * Get the access token from the Next.js auth endpoint
 * This is a minimal proxy that just returns the token for client-side use
 * Token is cached to avoid multiple requests
 */
async function getAccessToken(): Promise<string | null> {
  // Return cached token if available
  if (tokenCache) {
    return tokenCache;
  }

  // If a request is already in flight, return that promise
  if (tokenPromise) {
    return tokenPromise;
  }

  // Fetch token from Next.js auth endpoint
  tokenPromise = (async () => {
    try {
      // Call Next.js route to get the token (it reads from httpOnly cookie)
      const response = await axios.get("/api/auth/token", {
        withCredentials: true,
      });
      const token = response.data?.token || null;
      if (token) {
        tokenCache = token;
      }
      return token;
    } catch {
      // Token not available or expired
      tokenCache = null;
      return null;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

/**
 * Clear the token cache (useful after logout)
 */
export function clearTokenCache() {
  tokenCache = null;
  tokenPromise = null;
}

/**
 * Create an axios instance configured for the Nest API
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true, // Include cookies for CORS
  });

  // Add request interceptor to include auth token
  client.interceptors.request.use(
    async (config) => {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling and token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      // If 401, clear token cache and try to refresh
      if (error.response?.status === 401) {
        tokenCache = null;
        tokenPromise = null;
        
        // Try to refresh token via Next.js endpoint
        try {
          await axios.post("/api/auth/refresh", {}, { withCredentials: true });
          // Retry the original request with new token
          const newToken = await getAccessToken();
          if (newToken && error.config) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return client.request(error.config);
          }
        } catch {
          // Refresh failed, user needs to re-login
          if (process.env.NODE_ENV !== "production") {
            console.warn("Token refresh failed, user may need to re-login");
          }
        }
      }

      // Log errors in dev mode
      if (process.env.NODE_ENV !== "production") {
        if (error.response) {
          console.error(
            `API Error [${error.response.status}]:`,
            error.response.data
          );
        } else if (error.request) {
          console.error("API Request Error:", error.request);
        } else {
          console.error("API Error:", error.message);
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

// Export a singleton instance
export const apiClient = createApiClient();

// Export the base URL for direct use if needed
export { API_BASE_URL };

