"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPushPermission,
  isWebPushSubscribed,
  isWebPushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/lib/pwa/web-push";

export function PushNotificationsToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSupported(isWebPushSupported());
    setPermission(await getPushPermission());
    setSubscribed(await isWebPushSubscribed());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggle = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (subscribed) {
        await unsubscribeFromWebPush();
        setSubscribed(false);
        setMessage("Browser notifications turned off.");
      } else {
        const result = await subscribeToWebPush();
        if (!result.ok) {
          setMessage(result.message ?? "Could not enable notifications.");
        } else {
          setSubscribed(true);
          setPermission("granted");
          setMessage("You will receive alerts for in-app notifications.");
        }
      }
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [subscribed]);

  if (!supported) {
    return (
      <p className="mt-4 text-sm text-muted">
        Install the app and use Chrome, Edge, or Firefox on desktop/Android for
        push alerts. iOS supports push after adding to the Home Screen (iOS 16.4+).
      </p>
    );
  }

  const denied = permission === "denied";

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Browser push alerts</p>
          <p className="mt-0.5 text-sm text-muted">
            Order updates, reminders, and hub notifications—even when this tab is closed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={subscribed}
          aria-label={`Browser push alerts: ${subscribed ? "on" : "off"}`}
          disabled={busy || denied}
          onClick={() => void onToggle()}
          className={[
            "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors",
            subscribed
              ? "border-primary/60 bg-primary/80"
              : "border-border bg-background/80",
            denied ? "opacity-50" : "",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
              subscribed ? "translate-x-7" : "translate-x-1",
            ].join(" ")}
            aria-hidden
          />
        </button>
      </div>
      {denied ? (
        <p className="text-sm text-amber-300/90" role="status">
          Notifications are blocked in your browser settings. Allow notifications for
          this site, then return here to enable push.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
