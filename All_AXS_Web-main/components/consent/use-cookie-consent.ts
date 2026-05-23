"use client";

import { useSyncExternalStore } from "react";
import {
  type CookieConsentChoice,
  readCookieConsent,
  subscribeCookieConsent,
} from "./CookieConsentBanner";

/** SSR-safe hook for the persisted analytics cookie choice. */
export function useCookieConsent(): CookieConsentChoice | null {
  return useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    () => null,
  );
}
