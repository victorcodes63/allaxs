"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  dismissPwaInstall,
  isIosSafari,
  isPwaStandalone,
  readInstallDismissed,
  shouldOfferPwaInstall,
} from "@/lib/pwa/install";
import { readCookieConsent } from "@/components/consent/CookieConsentBanner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);
  const [cookieBarVisible, setCookieBarVisible] = useState(false);

  useEffect(() => {
    const sync = () => setCookieBarVisible(readCookieConsent() === null);
    sync();
    window.addEventListener("allaxs:cookie-consent-change", sync);
    return () => window.removeEventListener("allaxs:cookie-consent-change", sync);
  }, []);

  useEffect(() => {
    if (!shouldOfferPwaInstall(pathname) || readInstallDismissed()) {
      setVisible(false);
      return;
    }

    if (isPwaStandalone()) {
      setVisible(false);
      return;
    }

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setIosHint(false);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [pathname]);

  const onDismiss = useCallback(() => {
    dismissPwaInstall();
    setVisible(false);
    setDeferred(null);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user cancelled or browser blocked */
    } finally {
      setInstalling(false);
      setVisible(false);
      setDeferred(null);
    }
  }, [deferred]);

  if (!visible) return null;

  return (
    <div
      className={[
        "pointer-events-none fixed inset-x-0 z-[58] flex justify-center p-3 sm:p-4",
        cookieBarVisible
          ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(6rem+env(safe-area-inset-bottom))]"
          : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      ].join(" ")}
      role="region"
      aria-label="Install app"
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-3 rounded-[var(--radius-panel)] border border-primary/35 bg-[#0c0c0f]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Install All AXS</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {iosHint ? (
              <>
                Tap <span className="font-medium text-foreground/90">Share</span>
                , then{" "}
                <span className="font-medium text-foreground/90">
                  Add to Home Screen
                </span>{" "}
                for quick access to tickets and events.
              </>
            ) : (
              <>
                Add All AXS to your home screen for a full-screen app experience
                and faster access to your tickets.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
          {!iosHint ? (
            <button
              type="button"
              onClick={() => void onInstall()}
              disabled={installing || !deferred}
              className="inline-flex h-9 min-w-[7rem] items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {installing ? "Installing…" : "Install"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-button)] border border-border/80 px-3 text-xs font-semibold text-muted hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
