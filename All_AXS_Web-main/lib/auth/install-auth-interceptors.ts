"use client";

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { refreshSessionOnce } from "@/lib/auth/session-refresh-client";

type RetriableConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

let installed = false;

function shouldSkipAuthRetry(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/logout") ||
    url.includes("/api/auth/register")
  );
}

/**
 * Same-origin axios calls: on 401, refresh cookies once and retry.
 * Covers idle tabs where the access JWT expired but the refresh cookie is still good.
 */
export function installAuthInterceptors(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      if (
        !config ||
        error.response?.status !== 401 ||
        config._authRetry ||
        shouldSkipAuthRetry(config.url)
      ) {
        return Promise.reject(error);
      }

      config._authRetry = true;
      const refreshed = await refreshSessionOnce();
      if (!refreshed) return Promise.reject(error);

      return axios.request(config);
    },
  );
}
