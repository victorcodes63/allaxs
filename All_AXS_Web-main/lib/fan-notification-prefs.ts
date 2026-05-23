export type NotificationPrefs = {
  ordersEmail: boolean;
  marketingEmail: boolean;
  reminders: boolean;
};

const STORAGE_PREFIX = "allaxs-notification-prefs-";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  ordersEmail: true,
  marketingEmail: false,
  reminders: true,
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId.trim()}`;
}

export function getNotificationPrefs(userId: string): NotificationPrefs {
  if (typeof window === "undefined" || !userId.trim()) {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      ordersEmail:
        typeof parsed.ordersEmail === "boolean"
          ? parsed.ordersEmail
          : DEFAULT_NOTIFICATION_PREFS.ordersEmail,
      marketingEmail:
        typeof parsed.marketingEmail === "boolean"
          ? parsed.marketingEmail
          : DEFAULT_NOTIFICATION_PREFS.marketingEmail,
      reminders:
        typeof parsed.reminders === "boolean"
          ? parsed.reminders
          : DEFAULT_NOTIFICATION_PREFS.reminders,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function saveNotificationPrefs(userId: string, prefs: NotificationPrefs): void {
  if (typeof window === "undefined" || !userId.trim()) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}
