"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  isGuestOnlyPublicPath,
  isPublicBrowseActive,
  isPublicBrowseIntent,
  PUBLIC_BROWSE_COOKIE,
  readPublicBrowseCookieFromDocument,
  resolveGuestOnlyPublicRedirect,
} from "@/lib/auth/guest-only-public-routes";

/**
 * Client fallback for guest-only marketing routes (client navigations and
 * brief races before edge proxy runs). Mirrors `useReplaceIfAuthenticated`.
 */
export function useGuestOnlyPublicRedirect(): "idle" | "redirecting" {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    if (!pathname || !isGuestOnlyPublicPath(pathname)) return;
    if (isPublicBrowseIntent(searchParams) || readPublicBrowseCookieFromDocument()) {
      return;
    }

    const search = searchParams.toString();
    const qs = search ? `?${search}` : "";
    const target = resolveGuestOnlyPublicRedirect(
      pathname,
      qs,
      user.roles ?? [],
    );

    if (target !== `${pathname}${qs}`) {
      router.replace(target);
    }
  }, [loading, user, pathname, searchParams, router]);

  if (
    !loading &&
    user &&
    pathname &&
    isGuestOnlyPublicPath(pathname) &&
    !isPublicBrowseIntent(searchParams) &&
    !readPublicBrowseCookieFromDocument()
  ) {
    return "redirecting";
  }

  return "idle";
}
