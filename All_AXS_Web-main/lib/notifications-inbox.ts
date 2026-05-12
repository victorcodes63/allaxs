/** Same key as notifications page — "new" = created after last full inbox visit. */
export const NOTIFICATIONS_LAST_VISITED_AT_KEY = "allaxs_notifications_last_visited_at";

export type NotificationCategory = "orders" | "hosting" | "system";

export function normalizeNotificationCategory(
  raw: unknown,
): NotificationCategory {
  if (raw === "orders" || raw === "hosting" || raw === "system") return raw;
  return "system";
}
