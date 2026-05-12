"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NOTIFICATIONS_LAST_VISITED_AT_KEY } from "@/lib/notifications-inbox";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: "orders" | "hosting" | "system";
  link?: string;
  isRead: boolean;
};

type CategoryFilter = "all" | "orders" | "hosting" | "system";

function formatNotificationTime(value: string): string {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "just now";
  const diffMs = Date.now() - t;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(value).toLocaleDateString();
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [lastVisitedAt, setLastVisitedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFICATIONS_LAST_VISITED_AT_KEY);
      const prev = raw ? Number(raw) : Number.NaN;
      setLastVisitedAt(Number.isFinite(prev) ? prev : null);
      window.localStorage.setItem(NOTIFICATIONS_LAST_VISITED_AT_KEY, String(Date.now()));
    } catch {
      setLastVisitedAt(null);
    }
  }, []);

  const loadPage = useCallback(async (nextOffset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/notifications?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
        total?: number;
        offset?: number;
        limit?: number;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message || "Could not load notifications.");
        return;
      }
      const list = Array.isArray(data.notifications) ? data.notifications : [];
      setItems((prev) => (append ? [...prev, ...list] : list));
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      setTotal(typeof data.total === "number" ? data.total : list.length);
      setOffset(
        typeof data.offset === "number" ? data.offset + (data.limit ?? list.length) : nextOffset + list.length,
      );
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const markRead = useCallback(async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.isRead) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* optimistic */
    }
  }, [items]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* optimistic */
    }
  }, []);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);
  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [categoryFilter, items]);
  const filterCounts = useMemo(() => {
    return {
      all: items.length,
      orders: items.filter((i) => i.category === "orders").length,
      hosting: items.filter((i) => i.category === "hosting").length,
      system: items.filter((i) => i.category === "system").length,
    };
  }, [items]);

  return (
    <div className="space-y-8 pb-10">
      <header className="max-w-3xl space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Inbox
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Notifications
        </h1>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          Updates for your attendee and host activity in one place.
        </p>
      </header>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
          <p className="text-sm text-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:underline disabled:opacity-50"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
            <button
              type="button"
              className="text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:text-foreground"
              onClick={() => void loadPage(0, false)}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {([
            ["all", "All"],
            ["orders", "Orders"],
            ["hosting", "Hosting"],
            ["system", "System"],
          ] as Array<[CategoryFilter, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategoryFilter(value)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors",
                categoryFilter === value
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/80 bg-background/40 text-muted hover:text-foreground",
              ].join(" ")}
            >
              {label} {filterCounts[value]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading notifications…</p>
        ) : error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    void markRead(item.id);
                    if (item.link) router.push(item.link);
                  }}
                  className="w-full rounded-[var(--radius-card)] border border-border/70 bg-background/40 px-4 py-3 text-left transition-colors hover:bg-wash"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        item.isRead ? "bg-border" : "bg-primary",
                      ].join(" ")}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                        {lastVisitedAt && new Date(item.createdAt).getTime() > lastVisitedAt ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {item.body}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                        {formatNotificationTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <div className="mt-4 border-t border-border/70 pt-4">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
              disabled={loadingMore}
              onClick={() => void loadPage(offset, true)}
            >
              {loadingMore ? "Loading more…" : "Load more"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
