"use client";

import { useEffect } from "react";

/** Registers the service worker required for installable PWA on Chromium browsers. */
export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV === "development") {
      // Avoid stale SW fighting Next dev HMR.
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* install still possible on some browsers without SW */
    });
  }, []);

  return null;
}
