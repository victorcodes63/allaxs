"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { userInitials } from "@/lib/hub-user";
import { HubTopBar, type HubKind } from "@/components/layout/hub/HubTopBar";

export type HubNavItem = {
  href: string;
  label: string;
  /** When omitted, uses prefix match safe for list/detail under `href`. */
  match?: (pathname: string) => boolean;
};

export type HubNavSection = {
  title: string;
  items: HubNavItem[];
};

function defaultItemActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/") return false;
  return pathname.startsWith(`${href}/`);
}

export function hubItemActive(item: HubNavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return defaultItemActive(item.href, pathname);
}

type HubAppShellProps = {
  brandHome: string;
  /** Shown beside the logo in the sidebar header; omit for logo-only strip (e.g. organiser hub). */
  brandSubtitle?: string;
  hubEyebrow: string;
  /** `accent` uses primary (e.g. organiser); default `muted` for fan hub. */
  hubEyebrowTone?: "muted" | "accent";
  /** Drives top bar search targets and quick links. */
  hubKind: HubKind;
  sections: HubNavSection[];
  getPageTitle: (pathname: string) => string;
  user: { name?: string; email: string };
  children: React.ReactNode;
};

/** Shared horizontal rhythm for header + scroll body so titles line up with page content. */
const HUB_MAIN_PAD = "px-4 sm:px-6 lg:px-8";
const HUB_MAIN_MAX = "mx-auto w-full max-w-[min(100%,1400px)]";
/** One height for sidebar brand strip + main top bar (no step at the column join). */
const HUB_HEADER_H = "h-16";
/** Native scrollbars look out of place on dark hub chrome; keep overflow scroll without a visible track. */
const HUB_SCROLL_CHROME =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export function HubAppShell({
  brandHome,
  brandSubtitle,
  hubEyebrow,
  hubEyebrowTone = "muted",
  hubKind,
  sections,
  getPageTitle,
  user,
  children,
}: HubAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const title = getPageTitle(pathname);
  const initials = userInitials(user);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await axios.post("/api/auth/logout");
    } catch {
      /* still leave */
    } finally {
      setLoggingOut(false);
      closeDrawer();
      router.replace("/login");
    }
  };

  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="px-2" aria-label="Hub">
      {sections.map((section, sectionIndex) => (
        <div
          key={section.title}
          className={[
            "mb-1",
            sectionIndex > 0 ? "mt-6 border-t border-border/50 pt-6" : "",
          ].join(" ")}
        >
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = hubItemActive(item, pathname);
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative mx-1 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-200",
                    active
                      ? "bg-primary/[0.12] text-foreground shadow-[inset_3px_0_0_0_var(--primary)]"
                      : "text-foreground/65 hover:bg-wash hover:text-foreground",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const UserFooter = ({ compact }: { compact?: boolean }) => (
    <div
      className={[
        "shrink-0 border-t border-border/60 bg-gradient-to-t from-background/25 to-surface",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div
        className={[
          "rounded-[var(--radius-panel)] border border-border/50 bg-wash/25 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
          compact ? "p-2.5" : "p-3",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface text-xs font-semibold tracking-tight text-foreground ring-2 ring-primary/10"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug text-foreground">
              {user.name || "Member"}
            </p>
            <p className="mt-0.5 truncate text-xs leading-snug text-muted">
              {user.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-3 w-full rounded-[var(--radius-button)] border border-border/80 bg-background/50 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-[border-color,background-color,color] hover:border-primary/45 hover:bg-primary/[0.08] hover:text-foreground disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 min-w-0 w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar — `h-dvh` on shell (not `h-full`) keeps this rail full height when ancestors are content-sized (Suspense, etc.) */}
      <aside className="hidden h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div
          className={[
            `flex ${HUB_HEADER_H} shrink-0 items-center border-b border-border/90 bg-surface px-4`,
            brandSubtitle ? "justify-start" : "justify-center",
          ].join(" ")}
        >
          <Link
            href={brandHome}
            className={[
              "flex min-w-0 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
              brandSubtitle ? "flex-1" : "justify-center",
            ].join(" ")}
          >
            <Image
              src="/brand/logo-on-dark.png"
              alt="All AXS"
              width={140}
              height={34}
              className={[
                "h-8 w-auto max-w-[7.25rem] shrink-0 object-contain sm:max-w-[8.25rem]",
                brandSubtitle ? "object-left" : "object-center",
              ].join(" ")}
            />
            {brandSubtitle ? (
              <span className="min-w-0 truncate text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-primary">
                {brandSubtitle}
              </span>
            ) : null}
          </Link>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 ${HUB_SCROLL_CHROME}`}
        >
          <NavBlock />
        </div>
        <UserFooter />
      </aside>

      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        id="hub-mobile-drawer"
        inert={!drawerOpen}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,92vw)] max-w-full flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top,0px)] shadow-[8px_0_32px_-12px_rgba(0,0,0,0.45)] transition-transform duration-200 lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
        ].join(" ")}
      >
        <div
          className={`flex ${HUB_HEADER_H} shrink-0 items-center justify-between border-b border-border px-4`}
        >
          <span className="text-sm font-semibold">Menu</span>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-wash hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 ${HUB_SCROLL_CHROME}`}
        >
          <NavBlock onNavigate={closeDrawer} />
        </div>
        <UserFooter compact />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <HubTopBar
          hubKind={hubKind}
          brandHome={brandHome}
          hubEyebrow={hubEyebrow}
          hubEyebrowTone={hubEyebrowTone}
          title={title}
          user={user}
          drawerOpen={drawerOpen}
          onDrawerToggle={() => setDrawerOpen((o) => !o)}
          onLogout={onLogout}
          loggingOut={loggingOut}
          innerClassName={`${HUB_MAIN_MAX} flex min-h-[3.5rem] w-full items-center gap-2 sm:min-h-0 sm:h-16 sm:gap-3 ${HUB_MAIN_PAD}`}
        />

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${HUB_SCROLL_CHROME}`}
        >
          <div className={`${HUB_MAIN_MAX} ${HUB_MAIN_PAD} py-6 sm:py-8`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
