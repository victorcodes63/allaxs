"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/lib/auth";

function MainLink({
  href,
  children,
  onClick,
  marketingHome = false,
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
  /** Dark marketing header: light links + gradient active bar. */
  marketingHome?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href.startsWith("/#") || href === "#"
      ? false
      : href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "relative px-3 py-2.5 text-[14px] font-medium tracking-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-3.5 lg:px-4 lg:text-[15px]",
        marketingHome
          ? [
              "focus-visible:ring-primary/45 focus-visible:ring-offset-background",
              active ? "text-white" : "text-white/55 hover:text-white",
            ].join(" ")
          : [
              "hover:text-primary focus-visible:ring-primary/35 focus-visible:ring-offset-background",
              active ? "text-foreground" : "text-foreground/55",
            ].join(" "),
      ].join(" ")}
    >
      {children}
      <span
        className={[
          "absolute bottom-0 left-1 right-1 rounded-full transition-all sm:left-1.5 sm:right-1.5",
          marketingHome ? "h-0.5" : "h-px",
          active
            ? marketingHome
              ? "axs-bg-brand-gradient opacity-100"
              : "bg-primary opacity-100"
            : marketingHome
              ? "axs-bg-brand-gradient opacity-0 hover:opacity-50"
              : "bg-primary opacity-0 hover:opacity-40",
        ].join(" ")}
        aria-hidden
      />
    </Link>
  );
}

/** Core catalogue links (Terms / Privacy / Sell tickets live in footer or body CTAs). */
const NAV_LINKS = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/organizers", "For organizers"],
] as const;

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closeMenu = () => setOpen(false);

  const onAuthClick = async () => {
    if (!user) return;
    setLoggingOut(true);
    try {
      await axios.post("/api/auth/logout");
      router.replace("/login");
    } catch {
      router.replace("/login");
    } finally {
      setLoggingOut(false);
      closeMenu();
    }
  };

  /**
   * Signed-in: same destinations as `LoggedInBrowseChrome` (catalogue + account hub), not marketing
   * links (`/`, `/organizers`).
   */
  const desktopNavEntries: readonly (readonly [string, string])[] = user
    ? [
        ...([
          ["/events", "Events"],
          ["/tickets", "Tickets"],
          ["/dashboard", "Dashboard"],
        ] as const),
        ...(user.roles?.includes("ORGANIZER") || user.roles?.includes("ADMIN")
          ? ([["/organizer/dashboard", "Organizer"]] as const)
          : []),
        ...(user.roles?.includes("ADMIN") ? ([["/admin/moderation", "Admin"]] as const) : []),
      ]
    : [...NAV_LINKS];

  const signInClass =
    "rounded-[var(--radius-button)] border border-white/70 bg-transparent px-4 py-2.5 text-sm font-semibold text-white shadow-none transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5";

  const signUpClass =
    "axs-bg-brand-gradient inline-flex items-center justify-center rounded-[var(--radius-button)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5";

  return (
    <>
    <header
      className="sticky top-0 z-50 shrink-0 border-b border-white/10 bg-zinc-950/70 pt-[env(safe-area-inset-top,0px)] shadow-[0_12px_40px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 supports-backdrop-filter:bg-zinc-950/55"
    >
      <div className="axs-page-shell">
        <div className="grid min-h-[4.25rem] w-full grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-8 xl:gap-10">
          <div className="flex min-w-0 items-center justify-self-start">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="All AXS — Home"
            >
              <Image
                src="/brand/logo-on-dark.png"
                alt=""
                width={200}
                height={48}
                className="h-8 md:h-9 w-auto max-w-[160px] sm:max-w-[184px] object-contain object-left"
                priority
              />
              <span className="sr-only">All AXS</span>
            </Link>
          </div>

          <nav
            className="hidden min-w-0 flex-wrap items-center justify-center justify-self-center gap-x-0 gap-y-1 px-1 lg:flex lg:px-2"
            aria-label="Primary"
          >
            {desktopNavEntries.map(([href, label]) => (
              <MainLink key={`${href}-${label}`} href={href} marketingHome>
                {label}
              </MainLink>
            ))}
          </nav>

          <div className="col-start-2 row-start-1 flex items-center justify-self-end lg:col-start-3">
            <div className="flex items-center justify-end gap-3 sm:gap-4">
              {!user && (
                <div className="hidden items-center gap-3 lg:flex">
                  <Link href="/login" className={signInClass}>
                    Sign in
                  </Link>
                  <Link href="/register" className={signUpClass}>
                    Sign up
                  </Link>
                </div>
              )}
              {user ? (
                <div className="hidden lg:block">
                  <button
                    type="button"
                    onClick={onAuthClick}
                    disabled={loading || loggingOut}
                    className="axs-btn-surface border border-border bg-surface text-foreground shadow-[var(--btn-shadow-outline)] hover:bg-wash disabled:opacity-50 disabled:shadow-none"
                  >
                    {loggingOut ? "Signing out…" : "Log out"}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/10 lg:hidden"
                aria-expanded={open}
                aria-controls="site-drawer"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Close menu" : "Open menu"}
              >
                <span className="sr-only">Menu</span>
                {open ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 8h14M5 12h14M5 16h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-foreground/20 lg:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="site-drawer"
            className="fixed inset-y-0 right-0 z-[70] flex w-[min(100%,20rem)] flex-col border-l border-border bg-surface pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.35)] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-md p-2 text-foreground hover:bg-wash"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Mobile primary">
              {desktopNavEntries.map(([href, label]) => (
                <Link
                  key={`${href}-${label}`}
                  href={href}
                  onClick={closeMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="space-y-2 border-t border-border p-4">
              {!user ? (
                <>
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex min-h-[var(--btn-min-h)] w-full items-center justify-center rounded-[var(--radius-button)] border border-white/35 text-sm font-semibold text-white transition hover:border-white/55 hover:bg-white/[0.08]"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={closeMenu}
                    className="axs-bg-brand-gradient flex min-h-[var(--btn-min-h)] w-full items-center justify-center rounded-[var(--radius-button)] text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] hover:brightness-105"
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onAuthClick}
                  disabled={loading || loggingOut}
                  className="axs-btn-surface w-full border border-border bg-surface text-foreground shadow-[var(--btn-shadow-outline)] hover:bg-wash disabled:opacity-50 disabled:shadow-none"
                >
                  {loggingOut ? "Signing out…" : "Log out"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
