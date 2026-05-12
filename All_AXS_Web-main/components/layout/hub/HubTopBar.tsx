"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { userInitials } from "@/lib/hub-user";
import { NOTIFICATIONS_LAST_VISITED_AT_KEY, type NotificationCategory } from "@/lib/notifications-inbox";
import {
  applyHubNotificationReadToSnapshot,
  isHubNotificationsSnapshotFresh,
  loadHubNotificationsList,
  type CachedHubNotification,
} from "@/lib/notifications-hub-list";

export type HubKind = "attendee" | "organizer" | "admin";

type HubTopBarProps = {
  hubKind: HubKind;
  brandHome: string;
  hubEyebrow: string;
  hubEyebrowTone: "muted" | "accent";
  title: string;
  user: { name?: string; email: string; roles?: string[] };
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  onLogout: () => void | Promise<void>;
  loggingOut: boolean;
  /** Row inside max-width shell (padding + height). */
  innerClassName: string;
};

type HubNotification = CachedHubNotification;

type DropdownCategoryFilter = "all" | NotificationCategory;

function notificationCategoryLabel(cat: NotificationCategory): string {
  if (cat === "orders") return "Orders";
  if (cat === "hosting") return "Hosting";
  return "System";
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M15.8 15.8 21 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 8h14M5 12h14M5 16h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 9.8a5.5 5.5 0 1 1 11 0v3.3c0 .8.3 1.6.8 2.2l1 1.2H5.7l1-1.2c.5-.6.8-1.4.8-2.2V9.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

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

export function HubTopBar({
  hubKind,
  brandHome,
  hubEyebrow,
  hubEyebrowTone,
  title,
  user,
  drawerOpen,
  onDrawerToggle,
  onLogout,
  loggingOut,
  innerClassName,
}: HubTopBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownCategoryFilter, setDropdownCategoryFilter] =
    useState<DropdownCategoryFilter>("all");
  const [dropdownLastVisitedAt, setDropdownLastVisitedAt] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initials = userInitials(user);
  const canSwitchContext = Boolean(
    user.roles?.includes("ATTENDEE") && user.roles?.includes("ORGANIZER"),
  );
  const switchHref = hubKind === "attendee" ? "/organizer/dashboard" : "/dashboard";
  const switchLabel = hubKind === "attendee" ? "Host view" : "Attendee view";

  const baseQuickLinks =
    hubKind === "attendee"
      ? [
          { href: "/dashboard", label: "Overview" },
          { href: "/tickets", label: "My tickets" },
          { href: "/dashboard/events", label: "Browse events" },
        ]
      : hubKind === "admin"
        ? [
            { href: "/admin", label: "Overview" },
            { href: "/admin/events", label: "All events" },
            { href: "/admin/orders", label: "Orders" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/moderation", label: "Moderation queue" },
            { href: "/notifications", label: "Notifications" },
          ]
        : [
            { href: "/organizer/dashboard", label: "Overview" },
            { href: "/organizer/events", label: "Events" },
            { href: "/organizer/sales", label: "Sales & orders" },
            { href: "/organizer/tickets", label: "Tickets" },
            { href: "/organizer/account", label: "Account" },
          ];
  const quickLinks = canSwitchContext
    ? [
        {
          href: switchHref,
          label: `Switch to ${hubKind === "attendee" ? "Host" : "Attendee"}`,
        },
        ...baseQuickLinks,
      ]
    : baseQuickLinks;

  const loadNotifications = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;

    const showLoading = force || !isHubNotificationsSnapshotFresh();
    if (showLoading) {
      setNotificationsLoading(true);
    }
    setNotificationsError(null);

    try {
      const result = await loadHubNotificationsList({ limit: 8, force });
      if (!result.ok) {
        setNotificationsError(result.message);
        return;
      }
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.isRead) return;

    applyHubNotificationReadToSnapshot(id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Keep optimistic read state to avoid noisy badge flicker.
    }
  }, [notifications]);

  const onSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const q = search.trim();
      if (!q) return;
      if (hubKind === "attendee") {
        router.push(`/dashboard/events?q=${encodeURIComponent(q)}`);
      } else if (hubKind === "admin") {
        router.push(`/admin/moderation?search=${encodeURIComponent(q)}`);
      } else {
        router.push(`/organizer/events?q=${encodeURIComponent(q)}`);
      }
    },
    [hubKind, router, search],
  );

  useEffect(() => {
    if (!userMenuOpen && !notificationsOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (menuRef.current?.contains(t) || menuButtonRef.current?.contains(t)) {
        return;
      }
      if (
        notificationsRef.current?.contains(t) ||
        notificationsButtonRef.current?.contains(t)
      ) {
        return;
      }
      setUserMenuOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notificationsOpen, userMenuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el =
          document.getElementById("hub-global-search") ??
          document.getElementById("hub-global-search-mobile");
        el?.focus();
      }
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    try {
      const raw = window.localStorage.getItem(NOTIFICATIONS_LAST_VISITED_AT_KEY);
      const n = raw ? Number(raw) : Number.NaN;
      setDropdownLastVisitedAt(Number.isFinite(n) ? n : null);
    } catch {
      setDropdownLastVisitedAt(null);
    }
  }, [notificationsOpen]);

  const dropdownFilterCounts = useMemo(() => {
    return {
      all: notifications.length,
      orders: notifications.filter((n) => n.category === "orders").length,
      hosting: notifications.filter((n) => n.category === "hosting").length,
      system: notifications.filter((n) => n.category === "system").length,
    };
  }, [notifications]);

  const filteredDropdownNotifications = useMemo(() => {
    if (dropdownCategoryFilter === "all") return notifications;
    return notifications.filter((item) => item.category === dropdownCategoryFilter);
  }, [notifications, dropdownCategoryFilter]);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/75 pt-[env(safe-area-inset-top,0px)] shadow-[0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className={`${innerClassName} relative`}>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-border/90 bg-surface/80 text-foreground shadow-[var(--btn-shadow-outline)] transition-[border-color,box-shadow,background-color] hover:border-primary/35 hover:bg-wash lg:hidden"
          onClick={onDrawerToggle}
          aria-expanded={drawerOpen}
          aria-controls="hub-mobile-drawer"
          aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <MenuIcon />
          <span className="sr-only">Menu</span>
        </button>

        <nav
          className="flex min-w-0 flex-1 flex-col justify-center gap-1"
          aria-label="Page"
        >
          <Link
            href={brandHome}
            className={[
              "w-fit text-[10px] font-semibold uppercase leading-none tracking-[0.14em] transition-colors hover:underline",
              hubEyebrowTone === "accent" ? "text-primary" : "text-muted",
            ].join(" ")}
          >
            {hubEyebrow}
          </Link>
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
        </nav>

        <form
          onSubmit={onSearchSubmit}
          className="hidden min-w-0 shrink md:flex md:max-w-[min(22rem,34vw)] md:flex-1 md:justify-end lg:max-w-md"
          role="search"
        >
          <label htmlFor="hub-global-search" className="sr-only">
            Search
          </label>
          <div className="relative w-full">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="hub-global-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                hubKind === "attendee"
                  ? "Search events…"
                  : hubKind === "admin"
                    ? "Search submissions…"
                    : "Search your events…"
              }
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-wash/60 py-2 pl-9 pr-16 text-sm text-foreground placeholder:text-muted/70 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow,background-color] focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted xl:inline">
              ⌘K
            </kbd>
          </div>
        </form>

        {canSwitchContext ? (
          <Link
            href={switchHref}
            className="hidden shrink-0 items-center rounded-[var(--radius-button)] border border-border/80 bg-surface/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/90 shadow-[var(--btn-shadow-outline)] transition-[border-color,background-color] hover:border-primary/35 hover:bg-wash xl:inline-flex"
          >
            {switchLabel}
          </Link>
        ) : null}

        <div className="shrink-0">
          <button
            ref={notificationsButtonRef}
            type="button"
            onClick={() => {
              const next = !notificationsOpen;
              setNotificationsOpen(next);
              if (next) {
                setUserMenuOpen(false);
                void loadNotifications();
              }
            }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)] border border-border/80 bg-surface/70 text-foreground/80 shadow-[var(--btn-shadow-outline)] transition-[border-color,background-color,color] hover:border-primary/35 hover:bg-wash hover:text-foreground"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
            title="Notifications"
          >
            <BellIcon />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>

        {notificationsOpen ? (
            <div
              ref={notificationsRef}
              role="menu"
              className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-[var(--radius-panel)] border border-border/90 bg-surface shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Notifications
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/notifications"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    View all
                  </Link>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => void loadNotifications({ force: true })}
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 pb-2.5 pt-1">
                {(
                  [
                    ["all", "All"],
                    ["orders", "Orders"],
                    ["hosting", "Hosting"],
                    ["system", "System"],
                  ] as Array<[DropdownCategoryFilter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDropdownCategoryFilter(value)}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
                      dropdownCategoryFilter === value
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/80 bg-background/40 text-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {label} {dropdownFilterCounts[value]}
                  </button>
                ))}
              </div>
              {notificationsLoading ? (
                <p className="px-3 py-4 text-sm text-muted">Loading notifications…</p>
              ) : notificationsError ? (
                <p className="px-3 py-4 text-sm text-muted">{notificationsError}</p>
              ) : notifications.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>
              ) : filteredDropdownNotifications.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">Nothing in this category.</p>
              ) : (
                <ul className="max-h-[22rem] overflow-y-auto py-1">
                  {filteredDropdownNotifications.map((item) => {
                    const isNew =
                      dropdownLastVisitedAt != null &&
                      new Date(item.createdAt).getTime() > dropdownLastVisitedAt;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            void markNotificationRead(item.id);
                            setNotificationsOpen(false);
                            if (item.link) router.push(item.link);
                          }}
                          className={[
                            "w-full px-3 py-2.5 text-left transition-colors hover:bg-wash",
                            item.isRead ? "opacity-80" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={[
                                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                item.isRead ? "bg-border" : "bg-primary",
                              ].join(" ")}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                                  {item.title}
                                </p>
                                <span className="shrink-0 rounded-full border border-border/70 bg-background/40 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
                                  {notificationCategoryLabel(item.category)}
                                </span>
                                {isNew ? (
                                  <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-primary">
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
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

        <div className="hidden h-8 w-px shrink-0 bg-border/70 sm:block" aria-hidden />

        <div className="relative shrink-0" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            id={`${menuId}-trigger`}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-controls={`${menuId}-menu`}
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-[var(--radius-button)] border border-border/80 bg-surface/70 py-1 pl-1 pr-2 shadow-[var(--btn-shadow-outline)] transition-[border-color,box-shadow,background-color] hover:border-primary/35 hover:bg-wash sm:pr-2.5"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/25 to-primary/5 text-xs font-semibold text-foreground ring-1 ring-inset ring-primary/20"
              aria-hidden
            >
              {initials}
            </span>
            <span className="hidden min-w-0 max-w-[8rem] text-left sm:block">
              <span className="block truncate text-xs font-semibold leading-tight text-foreground">
                {user.name || "Member"}
              </span>
              <span className="block truncate text-[10px] leading-tight text-muted">
                {user.email}
              </span>
            </span>
            <ChevronDown
              className={[
                "hidden shrink-0 text-muted transition-transform duration-200 sm:block",
                userMenuOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {userMenuOpen ? (
            <div
              id={`${menuId}-menu`}
              role="menu"
              aria-labelledby={`${menuId}-trigger`}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-panel)] border border-border/90 bg-surface py-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)]"
            >
              <div className="border-b border-border/60 px-3 py-2.5 sm:hidden">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.name || "Member"}
                </p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <div className="py-1" role="none">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className="block px-3 py-2 text-sm text-foreground/90 transition-colors hover:bg-wash"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-border/60 py-1" role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/[0.08]"
                  disabled={loggingOut}
                  onClick={() => {
                    setUserMenuOpen(false);
                    void onLogout();
                  }}
                >
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="border-t border-border/50 bg-surface/30 px-4 py-2 md:hidden"
        role="search"
      >
        <label htmlFor="hub-global-search-mobile" className="sr-only">
          Search
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="hub-global-search-mobile"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              hubKind === "attendee"
                ? "Search events…"
                : hubKind === "admin"
                  ? "Search submissions…"
                  : "Search your events…"
            }
            className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-wash/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </form>
    </header>
  );
}
