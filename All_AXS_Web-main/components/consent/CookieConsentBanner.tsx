"use client";

import Link from "next/link";
import { useCallback, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCookieConsent } from "./use-cookie-consent";

/**
 * Persisted analytics-cookie choice.
 * - `null` (no key)  → undecided, banner is shown
 * - `"accepted"`     → load `@vercel/analytics`
 * - `"declined"`     → never load analytics on this device
 */
export type CookieConsentChoice = "accepted" | "declined";

export const COOKIE_CONSENT_STORAGE_KEY = "allaxs-cookie-consent";

/**
 * Read consent on the client. SSR-safe (returns `null` when `window` is missing,
 * value not yet stored, or value is otherwise unreadable).
 */
export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

/** Custom event fired after the user makes a choice so listeners (e.g. AnalyticsLoader) can react. */
const CONSENT_CHANGE_EVENT = "allaxs:cookie-consent-change";

function writeCookieConsent(choice: CookieConsentChoice) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    /* ignore storage failures (private mode, quota, etc.) */
  }
  window.dispatchEvent(new CustomEvent<CookieConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
}

/** Subscribe to consent changes (incl. cross-tab via `storage`). */
export function subscribeCookieConsent(listener: (choice: CookieConsentChoice | null) => void) {
  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentChoice>).detail;
    listener(detail ?? readCookieConsent());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
    listener(readCookieConsent());
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Slim, non-blocking bottom banner shown until the visitor accepts or declines analytics cookies.
 * Matches the site's dark marketing aesthetic (#0c0c0f surface, white/10 borders, primary gradient CTA).
 */
export function CookieConsentBanner() {
  const choice = useCookieConsent();
  const visible = choice === null;
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const descriptionId = useId();

  const decide = useCallback((choice: CookieConsentChoice) => {
    writeCookieConsent(choice);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="cookie-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom)))] sm:px-6"
        >
          <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0c0c0f]/95 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md supports-[backdrop-filter]:bg-[#0c0c0f]/80">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
              <div className="min-w-0 flex-1">
                <h2
                  id={headingId}
                  className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55"
                >
                  Cookies
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1.5 text-sm leading-relaxed text-white/80"
                >
                  We use lightweight analytics cookies to understand how All AXS is used and to improve
                  the experience. No ads, no third-party tracking. Read more in our{" "}
                  <Link
                    href="/privacy"
                    className="font-semibold text-white underline decoration-primary/60 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={() => decide("declined")}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-transparent px-5 py-2 text-sm font-semibold tracking-tight text-white/80 transition-colors duration-200 hover:border-white/35 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0f]"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => decide("accepted")}
                  className="inline-flex items-center justify-center rounded-full border border-transparent bg-[linear-gradient(115deg,var(--primary)_0%,var(--primary-dark)_55%,var(--accent-purple)_100%)] px-5 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_10px_24px_-12px_rgba(240,114,65,0.55)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-110 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0f]"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
