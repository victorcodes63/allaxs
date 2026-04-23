"use client";

import { Suspense, useLayoutEffect } from "react";
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
    if (
      p === "/organizer/onboarding" ||
      p.startsWith("/organizer/onboarding/")
    ) {
      return false;
    }
    /** `/organizers` (marketing) must not match `/organizer` (dashboard hub). */
    if (p === "/organizer" || p.startsWith("/organizer/")) return true;
    if (p === "/dashboard" || p.startsWith("/dashboard/")) return true;
    /** Wallet uses the same fan hub chrome when signed in; guests keep marketing chrome + session passes. */
    if (signedIn && (p === "/tickets" || p.startsWith("/tickets/"))) return true;
    return false;
  }

  /** Pathname can be empty briefly during navigation; avoid wrapping hub pages in browse chrome (breaks `HubAppShell` height). */
  if (!layoutSegments.length) return false;
  const seg = new Set(layoutSegments);
  if (seg.has("organizer") && seg.has("onboarding")) return false;
  if (seg.has("organizer")) return true;
  if (seg.has("dashboard")) return true;
  if (signedIn && seg.has("tickets")) return true;
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
  ] as const;
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  /** `body` uses `min-h-dvh`; without a hard cap the document can stay taller than the auth shell and scroll empty space below the footer. */
  useLayoutEffect(() => {
    if (!isPublicAuthPath(pathname)) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.height = "100dvh";
    body.style.minHeight = "0";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.minHeight = prev.bodyMinHeight;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, [pathname]);

  if (isHubPath(pathname, layoutSegments, !!user)) {
    return (
      <div className="flex h-dvh max-h-dvh min-h-0 flex-1 w-full flex-col overflow-hidden bg-background text-foreground">
        {children}
      </div>
    );
  }

  if (usesFullMarketingChrome(pathname)) {
    const fullBleedAuthMain = isPublicAuthPath(pathname);
    return (
      <div
        className={
          fullBleedAuthMain
            ? "flex h-dvh max-h-dvh min-h-0 flex-1 w-full flex-col overflow-hidden overscroll-none bg-background text-foreground"
            : "flex min-h-dvh flex-1 w-full flex-col bg-background text-foreground"
        }
      >
        <SiteHeader />
        <main
          className={
            fullBleedAuthMain
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent px-0 py-0"
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
