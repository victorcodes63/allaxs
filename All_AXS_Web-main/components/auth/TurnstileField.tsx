"use client";

import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
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

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser"));
  }
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10_000;
      const wait = () => {
        if (window.turnstile) resolve();
        else if (Date.now() > deadline) reject(new Error("Turnstile timeout"));
        else setTimeout(wait, 50);
      };
      wait();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
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
  /** Increment to destroy and re-render the widget (e.g. after a failed submit). */
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
  const siteKey = getTurnstileSiteKey();

  const stableOnToken = useCallback(
    (token: string) => {
      onToken(token);
    },
    [onToken],
  );

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: stableOnToken,
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onError?.(),
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, stableOnToken, onExpire, onError, resetSignal]);

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

  return <div ref={containerRef} className="flex min-h-[65px] justify-center py-1" />;
}
