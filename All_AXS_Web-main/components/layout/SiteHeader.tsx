"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SwapCtaLink } from "@/components/ui/SwapCtaLink";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/lib/auth";

function MainLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick?: () => void;
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
        "relative py-2 text-[14px] font-medium tracking-tight transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white lg:text-[15px]",
        active ? "text-foreground" : "text-foreground/55",
      ].join(" ")}
    >
      {children}
      <span
        className={[
          "absolute -bottom-1 left-0 right-0 h-px rounded-full transition-all",
          active ? "bg-primary opacity-100" : "bg-primary opacity-0 hover:opacity-40",
        ].join(" ")}
        aria-hidden
      />
    </Link>
  );
}

const mobileNav = [
  ["/events", "Events"],
  ["/tickets", "Tickets"],
  ["/organizers", "Organizers"],
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

  const closeMenu = () => setOpen(false);

  const onAuthClick = async () => {
    if (!user) {
      router.push("/login");
      closeMenu();
      return;
    }
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

  const isHome = pathname === "/";

  return (
    <header
      className={[
        "sticky top-0 z-50 backdrop-blur-2xl backdrop-saturate-150",
        isHome
          ? "border-b border-white/45 bg-white/52 shadow-none supports-backdrop-filter:bg-white/48"
          : "border-b border-border/60 bg-white/88 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.08)] supports-backdrop-filter:bg-white/72",
      ].join(" ")}
    >
      <div className="axs-page-shell">
        <div className="flex h-[4.25rem] items-center gap-4 lg:gap-6">
          {/* Brand */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="All AXS — Home"
          >
            <Image
              src="/brand/logo-header.png"
              alt=""
              width={200}
              height={48}
              className="h-8 md:h-9 w-auto max-w-[160px] sm:max-w-[184px] object-contain object-left"
              priority
            />
            <span className="sr-only">All AXS</span>
          </Link>

          {/* Desktop: centered navigation */}
          <nav
            className="hidden lg:flex flex-1 items-center justify-center gap-9 xl:gap-11"
            aria-label="Primary"
          >
            <MainLink href="/events">Events</MainLink>
            <MainLink href="/tickets">Tickets</MainLink>
            <MainLink href="/organizers">Organizers</MainLink>
            {user && (
              <>
                <MainLink href="/organizer/dashboard">Dashboard</MainLink>
                {user.roles?.includes("ADMIN") && (
                  <MainLink href="/admin/moderation">Admin</MainLink>
                )}
              </>
            )}
          </nav>

          {/* Desktop: auth — text sign-in with swap hover (guests) or Log out */}
          <div className="hidden lg:flex shrink-0 items-center">
            {user ? (
              <button
                type="button"
                onClick={onAuthClick}
                disabled={loading || loggingOut}
                className="axs-btn-surface border border-border bg-surface text-foreground shadow-[var(--btn-shadow-outline)] hover:bg-wash disabled:opacity-50 disabled:shadow-none"
              >
                {loggingOut ? "Signing out…" : "Log out"}
              </button>
            ) : (
              <SwapCtaLink
                href="/login"
                line1="Sign in"
                line2="Continue"
                look="text"
                className="text-foreground/70 transition-colors hover:text-primary"
              />
            )}
          </div>

          {/* Mobile: menu control */}
          <div className="ml-auto flex items-center gap-3 lg:hidden">
            {!user && (
              <Link
                href="/login"
                className="hidden text-sm font-semibold text-foreground/70 hover:text-primary sm:inline-flex"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground hover:bg-wash"
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

      {/* Mobile drawer — white panel, no dark overlay theatrics */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="site-drawer"
            className="fixed inset-y-0 right-0 z-50 w-[min(100%,20rem)] border-l border-border bg-white shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.12)] lg:hidden flex flex-col"
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
            <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1" aria-label="Mobile primary">
              {mobileNav.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                >
                  {label}
                </Link>
              ))}
              {user && (
                <>
                  <Link
                    href="/organizer/dashboard"
                    onClick={closeMenu}
                    className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                  >
                    Organizer dashboard
                  </Link>
                  {user.roles?.includes("ADMIN") && (
                    <Link
                      href="/admin/moderation"
                      onClick={closeMenu}
                      className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                    >
                      Admin
                    </Link>
                  )}
                </>
              )}
            </nav>
            <div className="border-t border-border p-4 space-y-3">
              {user ? (
                <button
                  type="button"
                  onClick={onAuthClick}
                  disabled={loading || loggingOut}
                  className="axs-btn-surface w-full border border-border bg-surface text-foreground shadow-[var(--btn-shadow-outline)] hover:bg-wash disabled:opacity-50 disabled:shadow-none"
                >
                  {loggingOut ? "Signing out…" : "Log out"}
                </button>
              ) : (
                <SwapCtaLink
                  href="/login"
                  line1="Sign in"
                  line2="Continue"
                  fullWidth
                  look="text"
                  onClick={closeMenu}
                  className="text-foreground/80 transition-colors hover:text-primary"
                />
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
