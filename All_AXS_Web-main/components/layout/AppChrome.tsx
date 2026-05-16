"use client";

import { Suspense } from "react";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LoggedInBrowseChrome } from "@/components/layout/LoggedInBrowseChrome";
import { useAuth } from "@/lib/auth";

function isHubPath(
  pathname: string | null,
  layoutSegments: string[],
  signedIn: boolean,
): boolean {
  const p = pathname && pathname.length > 0 ? pathname : null;

  if (p) {
    /** `/organizers` (marketing) must not match `/organizer` (dashboard hub). */
    if (p === "/organizer" || p.startsWith("/organizer/")) return true;
    if (p === "/dashboard" || p.startsWith("/dashboard/")) return true;
    /**
     * `/admin/*` is admin-only by definition — the admin layout itself
     * gates access and redirects guests to /login. Do NOT also gate on
     * `signedIn` here: `useAuth` is component-local state, so this
     * `AppChrome` instance can disagree with the admin layout's
     * instance during fetch races, which leaks the marketing
     * `SiteHeader` (with Sign in / Sign up) on top of the admin shell.
     */
    if (p === "/admin" || p.startsWith("/admin/")) return true;
    /** Wallet uses the same fan hub chrome when signed in; guests keep marketing chrome + session passes. */
    if (signedIn && (p === "/tickets" || p.startsWith("/tickets/"))) return true;
    if (signedIn && (p === "/notifications" || p.startsWith("/notifications/"))) return true;
    return false;
  }

  /** Pathname can be empty briefly during navigation; avoid wrapping hub pages in browse chrome (breaks `HubAppShell` height). */
  if (!layoutSegments.length) return false;
  const seg = new Set(layoutSegments);
  if (seg.has("organizer")) return true;
  if (seg.has("dashboard")) return true;
  if (seg.has("admin")) return true;
  if (signedIn && seg.has("tickets")) return true;
  if (signedIn && seg.has("notifications")) return true;
  return false;
}

/** Guest-style marketing chrome even when a session exists (sign-in / account recovery flows). */
function isPublicAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const paths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
  ] as const;
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Sign-in / sign-up — full-bleed auth shell without marketing nav (footer stays). */
function isSignInSignUpPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/")
  );
}

/** Landing — same full marketing header/footer as `/events` when signed in (avoids swapping to browse-only chrome mid-journey). */
function isPublicHomePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/";
}

/** Public catalogue + detail under `/events/*` — same marketing chrome when signed in. */
function isPublicEventsCatalogPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/events" || pathname.startsWith("/events/");
}

/** Public organizers marketing — full header/footer like `/events` (including when signed in). */
function isOrganizersMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/organizers" || pathname.startsWith("/organizers/");
}

function usesFullMarketingChrome(pathname: string | null): boolean {
  return (
    isPublicAuthPath(pathname) ||
    isPublicHomePath(pathname) ||
    isPublicEventsCatalogPath(pathname) ||
    isOrganizersMarketingPath(pathname)
  );
}

function AppChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const layoutSegments = useSelectedLayoutSegments();
  const { user, loading } = useAuth();
  const shellClass =
    "flex min-h-dvh flex-1 w-full flex-col bg-background text-foreground";

  if (isHubPath(pathname, layoutSegments, !!user)) {
    return (
      <div className="flex h-dvh max-h-dvh min-h-0 flex-1 w-full flex-col overflow-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }

  if (usesFullMarketingChrome(pathname)) {
    const fullBleedAuthMain = isPublicAuthPath(pathname);
    const headlessAuth = isSignInSignUpPath(pathname);
    return (
      <div
        className={
          fullBleedAuthMain
            ? "flex min-h-dvh flex-1 w-full flex-col bg-transparent text-foreground"
            : "flex min-h-dvh flex-1 w-full flex-col bg-background text-foreground"
        }
      >
        {!headlessAuth ? <SiteHeader /> : null}
        <main
          className={
            fullBleedAuthMain
              ? "relative flex flex-1 flex-col bg-transparent px-0 py-0"
              : "flex-1 axs-page-shell py-8 md:py-10"
          }
        >
          {children}
        </main>
        <SiteFooter authContinuation={fullBleedAuthMain} />
      </div>
    );
  }

  if (user) {
    return (
      <div className={shellClass}>
        <LoggedInBrowseChrome />
        <main className="min-h-0 flex-1 axs-page-shell py-8 md:py-10">{children}</main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={shellClass}>
        <SiteHeader />
        <main className="flex-1 axs-page-shell py-8 md:py-10">{children}</main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <SiteHeader />
      <main className="flex-1 axs-page-shell py-8 md:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-1 w-full flex-col bg-background text-foreground">
          <SiteHeader />
          <main className="flex-1 axs-page-shell py-8 md:py-10">{children}</main>
        </div>
      }
    >
      <AppChromeInner>{children}</AppChromeInner>
    </Suspense>
  );
}
