"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import {
  normalizeWebUserRoles,
  rolesIncludeAdmin,
  shouldOfferOrganizerHub,
} from "@/lib/auth/hub-routing";
import { buildAuthQuery } from "@/lib/auth/post-auth-redirect";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const onOnboarding =
    pathname === "/organizer/onboarding" ||
    pathname.startsWith("/organizer/onboarding/");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const nextPath = pathname || "/organizer/dashboard";
      router.replace(
        `/login${buildAuthQuery({ next: nextPath, intent: "host" })}`,
      );
      return;
    }
    const roles = normalizeWebUserRoles(user.roles);
    if (rolesIncludeAdmin(roles)) {
      router.replace("/admin");
      return;
    }
    const canOrganizerApp = shouldOfferOrganizerHub(roles);
    if (!onOnboarding && !canOrganizerApp) {
      router.replace("/organizer/onboarding");
    }
  }, [loading, user, onOnboarding, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  const roles = normalizeWebUserRoles(user.roles);
  if (rolesIncludeAdmin(roles)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Redirecting…</p>
      </div>
    );
  }

  const canOrganizerApp = shouldOfferOrganizerHub(roles);
  if (!onOnboarding && !canOrganizerApp) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Redirecting…</p>
      </div>
    );
  }

  if (onOnboarding) {
    return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
  }

  return <OrganizerShell user={user}>{children}</OrganizerShell>;
}
