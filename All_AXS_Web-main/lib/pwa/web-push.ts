export type PushVapidConfig = {
  publicKey: string | null;
  enabled: boolean;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function fetchPushVapidConfig(): Promise<PushVapidConfig> {
  const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
  if (!res.ok) {
    return { publicKey: null, enabled: false };
  }
  const data = (await res.json()) as PushVapidConfig;
  return {
    publicKey: data.publicKey ?? null,
    enabled: Boolean(data.enabled && data.publicKey),
  };
}

export async function getPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isWebPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function subscribeToWebPush(): Promise<{ ok: boolean; message?: string }> {
  if (!isWebPushSupported()) {
    return { ok: false, message: "Push notifications are not supported in this browser." };
  }

  const { publicKey, enabled } = await fetchPushVapidConfig();
  if (!enabled || !publicKey) {
    return {
      ok: false,
      message: "Push is not configured on the server yet.",
    };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was denied." };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys.auth) {
    return { ok: false, message: "Could not read push subscription from the browser." };
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: navigator.userAgent,
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return {
      ok: false,
      message: data.message || "Could not save push subscription.",
    };
  }

  return { ok: true };
}

export async function unsubscribeFromWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe().catch(() => undefined);
}

export async function isWebPushSubscribed(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return Boolean(subscription);
}
