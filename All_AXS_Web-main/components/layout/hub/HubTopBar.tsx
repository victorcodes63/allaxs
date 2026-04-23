"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { userInitials } from "@/lib/hub-user";

export type HubKind = "attendee" | "organizer";

type HubTopBarProps = {
  hubKind: HubKind;
  brandHome: string;
  hubEyebrow: string;
  hubEyebrowTone: "muted" | "accent";
  title: string;
  user: { name?: string; email: string };
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  onLogout: () => void | Promise<void>;
  loggingOut: boolean;
  /** Row inside max-width shell (padding + height). */
  innerClassName: string;
};

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
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initials = userInitials(user);

  const quickLinks =
    hubKind === "attendee"
      ? [
          { href: "/dashboard", label: "Overview" },
          { href: "/tickets", label: "My tickets" },
          { href: "/events", label: "Browse events" },
        ]
      : [
          { href: "/organizer/dashboard", label: "Overview" },
          { href: "/organizer/events", label: "Events" },
          { href: "/organizer/sales", label: "Sales & orders" },
          { href: "/organizer/tickets", label: "Tickets" },
          { href: "/organizer/account", label: "Account" },
        ];

  const onSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const q = search.trim();
      if (!q) return;
      if (hubKind === "attendee") {
        router.push(`/events?q=${encodeURIComponent(q)}`);
      } else {
        router.push(`/organizer/events?q=${encodeURIComponent(q)}`);
      }
    },
    [hubKind, router, search],
  );

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (menuRef.current?.contains(t) || menuButtonRef.current?.contains(t)) {
        return;
      }
      setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el =
          document.getElementById("hub-global-search") ??
          document.getElementById("hub-global-search-mobile");
        el?.focus();
      }
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/75 pt-[env(safe-area-inset-top,0px)] shadow-[0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className={innerClassName}>
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
                  : "Search your events…"
              }
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-wash/60 py-2 pl-9 pr-16 text-sm text-foreground placeholder:text-muted/70 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition-[border-color,box-shadow,background-color] focus:border-primary/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted xl:inline">
              ⌘K
            </kbd>
          </div>
        </form>

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
              hubKind === "attendee" ? "Search events…" : "Search your events…"
            }
            className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-wash/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </form>
    </header>
  );
}
