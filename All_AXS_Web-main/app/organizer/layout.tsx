"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import {
  normalizeWebUserRoles,
  userHasRole,
} from "@/lib/auth/hub-routing";
import { userHasHostAccountInDb } from "@/lib/auth/intent-access";
import { buildAuthQuery } from "@/lib/auth/post-auth-redirect";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [rolesReady, setRolesReady] = useState(false);
  const onOnboarding =
    pathname === "/organizer/onboarding" ||
    pathname.startsWith("/organizer/onboarding/");
  const onTeamJoin =
    pathname === "/organizer/team/join" ||
    pathname.startsWith("/organizer/team/join/");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRolesReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setRolesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, refresh]);

  useEffect(() => {
    if (loading || !rolesReady) return;
    if (!user && !onTeamJoin) {
      const nextPath = pathname || "/organizer/dashboard";
      router.replace(
        `/login${buildAuthQuery({ next: nextPath, intent: "host" })}`,
      );
      return;
    }
    if (!user) return;
    if (userHasRole(user, "ADMIN")) {
      router.replace("/admin");
      return;
    }
    const roles = normalizeWebUserRoles(user.roles);
    const canOrganizerApp = userHasHostAccountInDb(roles);
    const isOrganizer = userHasRole(user, "ORGANIZER");
    if (onOnboarding && !isOrganizer) {
      router.replace("/dashboard?notice=noHostAccount");
      return;
    }
    if (!onOnboarding && !canOrganizerApp) {
      router.replace("/dashboard");
      return;
    }
  }, [loading, rolesReady, user, onOnboarding, onTeamJoin, router, pathname]);

  if (onTeamJoin) {
    if (loading || (user && !rolesReady)) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-muted">Loading…</p>
        </div>
      );
    }
    if (!user) {
      return <div className="min-h-[50vh]">{children}</div>;
    }
    return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
  }

  if (loading || !user || !rolesReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (userHasRole(user, "ADMIN")) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Redirecting…</p>
      </div>
    );
  }

  const roles = normalizeWebUserRoles(user.roles);
  const canOrganizerApp = userHasHostAccountInDb(roles);
  const isOrganizer = userHasRole(user, "ORGANIZER");
  if (onOnboarding && !isOrganizer) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Redirecting…</p>
      </div>
    );
  }
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
