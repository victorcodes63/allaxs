export type NotificationPrefs = {
  ordersEmail: boolean;
  marketingEmail: boolean;
  reminders: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ordersEmail: true,
  marketingEmail: false,
  reminders: true,
};

function normalizePartial(raw: Partial<NotificationPrefs>): NotificationPrefs {
  return {
    ordersEmail:
      typeof raw.ordersEmail === "boolean"
        ? raw.ordersEmail
        : DEFAULT_NOTIFICATION_PREFS.ordersEmail,
    marketingEmail:
      typeof raw.marketingEmail === "boolean"
        ? raw.marketingEmail
        : DEFAULT_NOTIFICATION_PREFS.marketingEmail,
    reminders:
      typeof raw.reminders === "boolean"
        ? raw.reminders
        : DEFAULT_NOTIFICATION_PREFS.reminders,
  };
}

export async function fetchNotificationPrefs(): Promise<NotificationPrefs> {
  const res = await fetch("/api/auth/notification-preferences", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unable to load notification preferences");
  }
  const data = (await res.json()) as { preferences?: Partial<NotificationPrefs> };
  return normalizePartial(data.preferences ?? {});
}

export async function saveNotificationPrefs(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const res = await fetch("/api/auth/notification-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json().catch(() => ({}))) as {
    preferences?: Partial<NotificationPrefs>;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || "Unable to save notification preferences");
  }
  return normalizePartial(data.preferences ?? patch);
}
