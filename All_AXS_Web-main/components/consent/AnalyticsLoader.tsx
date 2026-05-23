"use client";

import { Analytics } from "@vercel/analytics/react";
import { useCookieConsent } from "./use-cookie-consent";

/**
 * Mounts `<Analytics />` only after the visitor has accepted analytics cookies.
 * Reacts to consent changes within the same tab and across tabs (`storage` event).
 */
export function AnalyticsLoader() {
  const choice = useCookieConsent();

  if (choice !== "accepted") return null;
  return <Analytics />;
}
