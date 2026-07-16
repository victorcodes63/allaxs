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
          size?: "normal" | "compact" | "flexible";
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
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const verifiedRef = useRef(false);
  const [stuckHint, setStuckHint] = useState(false);
  const [verified, setVerified] = useState(false);
  const siteKey = getTurnstileSiteKey();

  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  const clearStuckTimer = () => {
    if (stuckTimerRef.current) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = undefined;
    }
  };

  const armStuckTimer = () => {
    clearStuckTimer();
    stuckTimerRef.current = setTimeout(() => {
      if (!verifiedRef.current) setStuckHint(true);
    }, STUCK_HINT_MS);
  };

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          // Invisible unless Cloudflare needs a challenge — keeps auth UI clean.
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => {
            clearStuckTimer();
            verifiedRef.current = true;
            setStuckHint(false);
            setVerified(true);
            onTokenRef.current(token);
          },
          "expired-callback": () => {
            verifiedRef.current = false;
            setVerified(false);
            armStuckTimer();
            onExpireRef.current?.();
          },
          "error-callback": () => {
            verifiedRef.current = false;
            setVerified(false);
            setStuckHint(true);
            onErrorRef.current?.();
          },
        });

        armStuckTimer();
      })
      .catch(() => {
        setStuckHint(true);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      clearStuckTimer();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per site key
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal <= 0 || !widgetIdRef.current || !window.turnstile) return;
    window.turnstile.reset(widgetIdRef.current);
    verifiedRef.current = false;
    setVerified(false);
    setStuckHint(false);
    armStuckTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* Keep mounted so the widget is not torn down; collapse after success. */}
      <div
        ref={containerRef}
        className={
          verified
            ? "pointer-events-none h-0 overflow-hidden opacity-0"
            : "flex min-h-0 justify-center py-0.5"
        }
        aria-hidden={verified}
      />
      {stuckHint && !verified ? (
        <p className="text-center text-xs text-neutral-400">
          Security check is taking longer than usual. Refresh the page or try disabling ad
          blockers.
        </p>
      ) : null}
    </div>
  );
}
