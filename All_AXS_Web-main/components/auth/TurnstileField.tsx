"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script";
const READY_TIMEOUT_MS = 10_000;
const STUCK_HINT_MS = 25_000;

function waitForTurnstile(): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    const wait = () => {
      if (window.turnstile) resolve();
      else if (Date.now() > deadline) reject(new Error("Turnstile timeout"));
      else setTimeout(wait, 50);
    };
    wait();
  });
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser"));
  }
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) return waitForTurnstile();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      waitForTurnstile().then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
}

export function getTurnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

type TurnstileFieldProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /** Increment to reset the widget in place (e.g. after a failed submit). */
  resetSignal?: number;
};

export function TurnstileField({
  onToken,
  onExpire,
  onError,
  resetSignal = 0,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const [stuckHint, setStuckHint] = useState(false);
  const siteKey = getTurnstileSiteKey();

  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  // Mount once per site key. Callbacks use refs so parent re-renders do not
  // destroy/recreate the widget (that caused endless "Verifying…" loops).
  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;
    let stuckTimer: ReturnType<typeof setTimeout> | undefined;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          appearance: "always",
          callback: (token) => {
            setStuckHint(false);
            onTokenRef.current(token);
          },
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => {
            setStuckHint(true);
            onErrorRef.current?.();
          },
        });

        stuckTimer = setTimeout(() => setStuckHint(true), STUCK_HINT_MS);
      })
      .catch(() => {
        setStuckHint(true);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (stuckTimer) clearTimeout(stuckTimer);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal <= 0 || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    setStuckHint(false);
  }, [resetSignal]);

  if (!siteKey) {
    if (process.env.NODE_ENV === "production") {
      return (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          Security verification is temporarily unavailable. Please try again later or contact
          support.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="flex min-h-[65px] justify-center py-1" />
      {stuckHint ? (
        <p className="text-center text-xs text-neutral-400">
          Security check is taking longer than usual. Refresh the page or try disabling ad
          blockers.
        </p>
      ) : null}
    </div>
  );
}
