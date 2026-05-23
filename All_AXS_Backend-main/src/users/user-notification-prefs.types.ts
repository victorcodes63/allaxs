export type UserNotificationPrefs = {
  ordersEmail: boolean;
  marketingEmail: boolean;
  reminders: boolean;
};

export const DEFAULT_USER_NOTIFICATION_PREFS: UserNotificationPrefs = {
  ordersEmail: true,
  marketingEmail: false,
  reminders: true,
};

export function normalizeNotificationPrefs(
  raw: unknown,
): UserNotificationPrefs {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_USER_NOTIFICATION_PREFS };
  }
  const row = raw as Record<string, unknown>;
  return {
    ordersEmail:
      typeof row.ordersEmail === 'boolean'
        ? row.ordersEmail
        : DEFAULT_USER_NOTIFICATION_PREFS.ordersEmail,
    marketingEmail:
      typeof row.marketingEmail === 'boolean'
        ? row.marketingEmail
        : DEFAULT_USER_NOTIFICATION_PREFS.marketingEmail,
    reminders:
      typeof row.reminders === 'boolean'
        ? row.reminders
        : DEFAULT_USER_NOTIFICATION_PREFS.reminders,
  };
}

export function mergeNotificationPrefs(
  current: UserNotificationPrefs,
  patch: Partial<UserNotificationPrefs>,
): UserNotificationPrefs {
  return {
    ordersEmail:
      typeof patch.ordersEmail === 'boolean'
        ? patch.ordersEmail
        : current.ordersEmail,
    marketingEmail:
      typeof patch.marketingEmail === 'boolean'
        ? patch.marketingEmail
        : current.marketingEmail,
    reminders:
      typeof patch.reminders === 'boolean'
        ? patch.reminders
        : current.reminders,
  };
}
