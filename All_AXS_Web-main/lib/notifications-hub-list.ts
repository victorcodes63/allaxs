import { normalizeNotificationCategory, type NotificationCategory } from "@/lib/notifications-inbox";

export type CachedHubNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: NotificationCategory;
  link?: string;
  isRead: boolean;
};

type Snapshot = {
  fetchedAt: number;
  notifications: CachedHubNotification[];
  unreadCount: number;
};

let snapshot: Snapshot | null = null;

const DEFAULT_MIN_MS = 120_000;

function resolveMinIntervalMs(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_NOTIFICATIONS_HUB_MIN_INTERVAL_MS
      : undefined;
  const parsed = raw != null && raw !== "" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_MS;
  return Math.min(Math.max(parsed, 30_000), 1_800_000);
}

export function isHubNotificationsSnapshotFresh(now = Date.now()): boolean {
  if (!snapshot) return false;
  return now - snapshot.fetchedAt < resolveMinIntervalMs();
}

/** Keep server snapshot aligned when the user reads an item from the hub UI. */
export function applyHubNotificationReadToSnapshot(id: string): void {
  if (!snapshot) return;
  const hit = snapshot.notifications.find((n) => n.id === id);
  if (!hit || hit.isRead) return;
  snapshot = {
    fetchedAt: snapshot.fetchedAt,
    notifications: snapshot.notifications.map((n) =>
      n.id === id ? { ...n, isRead: true } : n,
    ),
    unreadCount: Math.max(0, snapshot.unreadCount - 1),
  };
}

export type HubListLoadOk = {
  ok: true;
  fromCache: boolean;
  notifications: CachedHubNotification[];
  unreadCount: number;
};

export type HubListLoadErr = {
  ok: false;
  fromCache: false;
  message: string;
};

export type HubListLoadResult = HubListLoadOk | HubListLoadErr;

/** Dedup concurrent background fetches (remount / rapid dropdown opens). */
let sharedFetchInFlight: Promise<HubListLoadResult> | null = null;

function normalizeList(rawList: unknown[]): CachedHubNotification[] {
  return rawList.map((item) => {
    const row = item as CachedHubNotification & { category?: unknown };
    return {
      ...row,
      category: normalizeNotificationCategory(row.category),
    };
  });
}

async function fetchHubListFromNetwork(limit: number): Promise<HubListLoadResult> {
  try {
    const res = await fetch(`/api/notifications?limit=${limit}`, {
      method: "GET",
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as {
      notifications?: unknown[];
      unreadCount?: number;
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        fromCache: false,
        message: data.message || "Could not load notifications.",
      };
    }

    const rawList = Array.isArray(data.notifications) ? data.notifications : [];
    const notifications = normalizeList(rawList);
    const unreadCount = typeof data.unreadCount === "number" ? data.unreadCount : 0;

    snapshot = {
      fetchedAt: Date.now(),
      notifications,
      unreadCount,
    };

    return { ok: true, fromCache: false, notifications, unreadCount };
  } catch {
    return { ok: false, fromCache: false, message: "Could not load notifications." };
  }
}

/**
 * Loads the short hub notifications list (/api/notifications?limit=N).
 *
 * - Serves cached data without network when snapshot is fresher than
 *   `NEXT_PUBLIC_NOTIFICATIONS_HUB_MIN_INTERVAL_MS` (default 120s, min 30s, max 30m).
 * - `force: true` skips the freshness gate but still refreshes snapshot on success (Refresh button).
 * - Concurrent non-forced callers share one in-flight request.
 */
export async function loadHubNotificationsList(options: {
  limit?: number;
  force?: boolean;
}): Promise<HubListLoadResult> {
  const limit = options.limit ?? 8;
  const force = options.force ?? false;

  if (!force && isHubNotificationsSnapshotFresh() && snapshot) {
    return {
      ok: true,
      fromCache: true,
      notifications: snapshot.notifications,
      unreadCount: snapshot.unreadCount,
    };
  }

  if (force) {
    return fetchHubListFromNetwork(limit);
  }

  if (!sharedFetchInFlight) {
    sharedFetchInFlight = fetchHubListFromNetwork(limit).finally(() => {
      sharedFetchInFlight = null;
    });
  }
  return sharedFetchInFlight;
}
