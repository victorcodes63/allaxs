"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/lib/auth";

/**
 * When signed in on marketing routes, replace the full SiteHeader/SiteFooter
 * with a compact bar so the experience reads as “in the app” not a guest landing page.
 */
export function LoggedInBrowseChrome() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

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

  if (!user) return null;

  const closeMenu = () => setOpen(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await axios.post("/api/auth/logout");
    } catch {
      /* still leave */
    } finally {
      setBusy(false);
    }
    closeMenu();
    router.replace("/login");
  };

  const link = (href: string, label: string, onClick?: () => void) => {
    const active =
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={onClick}
        className={[
          "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          active ? "bg-primary/10 text-foreground" : "text-foreground/65 hover:bg-wash hover:text-foreground",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  const showOrganizer =
    user.roles?.includes("ORGANIZER") || user.roles?.includes("ADMIN");

  const navLinks = (
    <>
      {link("/events", "Events")}
      {link("/tickets", "Tickets")}
      {link("/dashboard", "Dashboard")}
      {showOrganizer ? link("/organizer/dashboard", "Organiser") : null}
      {user.roles?.includes("ADMIN") ? link("/admin/moderation", "Admin") : null}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/88">
      <div className="axs-page-shell flex min-h-[4.25rem] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="All AXS home">
            <Image
              src="/brand/logo-on-dark.png"
              alt=""
              width={120}
              height={28}
              className="h-7 w-auto max-w-[7.5rem] object-contain object-left"
            />
          </Link>
          <nav
            className="hidden min-w-0 items-center gap-0.5 md:flex"
            aria-label="Signed-in navigation"
          >
            {navLinks}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[10rem] truncate text-xs text-muted md:inline">
            {user.name || user.email}
          </span>
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="hidden rounded-[var(--radius-button)] border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/80 transition-colors hover:border-primary hover:text-foreground disabled:opacity-50 md:inline-flex"
          >
            {busy ? "…" : "Log out"}
          </button>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground hover:bg-wash md:hidden"
            aria-expanded={open}
            aria-controls="browse-drawer"
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

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="browse-drawer"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(100%,20rem)] flex-col border-l border-border bg-surface pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.35)] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Account menu"
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
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Mobile signed-in navigation">
              <Link
                href="/events"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
              >
                Events
              </Link>
              <Link
                href="/tickets"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
              >
                Tickets
              </Link>
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
              >
                Dashboard
              </Link>
              {showOrganizer ? (
                <Link
                  href="/organizer/dashboard"
                  onClick={closeMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                >
                  Organiser
                </Link>
              ) : null}
              {user.roles?.includes("ADMIN") ? (
                <Link
                  href="/admin/moderation"
                  onClick={closeMenu}
                  className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-wash"
                >
                  Admin
                </Link>
              ) : null}
            </nav>
            <div className="space-y-3 border-t border-border p-4">
              <p className="truncate px-1 text-xs text-muted">{user.name || user.email}</p>
              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className="axs-btn-surface w-full border border-border bg-background text-foreground shadow-[var(--btn-shadow-outline)] hover:bg-wash disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
