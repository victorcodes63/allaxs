"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import { buildLoginRedirectFromPath } from "@/lib/auth/post-auth-redirect";
import {
  landingPathForNonAttendee,
  preferredHubShell,
  type HubShellChoice,
} from "@/lib/auth/hub-routing";

export type HubAccessMode =
  /** Fan dashboard: ATTENDEE shell only; pure admin/organizer accounts are redirected away. */
  | "fan-only"
  /**
   * Shared inbox-style routes (`/notifications`, etc.): pick shell from roles so
   * moderators and hosts see the right chrome without leaving their workspace.
   */
  | "role-shell";

type HubAccessLayoutProps = {
  mode: HubAccessMode;
  children: React.ReactNode;
  /** When false, unsigned visitors see page content without a hub shell (rare). */
  requireAuth?: boolean;
};

function HubRedirectState({ label = "Redirecting…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function RoleShell({ choice, user, children }: {
  choice: HubShellChoice;
  user: { name?: string; email: string; roles?: string[] };
  children: React.ReactNode;
}) {
  if (choice === "admin") {
    return <AdminShell user={user}>{children}</AdminShell>;
  }
  if (choice === "organizer") {
    return <OrganizerShell user={user}>{children}</OrganizerShell>;
  }
  return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
}

export function HubAccessLayout({
  mode,
  children,
  requireAuth = true,
}: HubAccessLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !user) {
      router.replace(
        pathname ? buildLoginRedirectFromPath(pathname) : "/login",
      );
      return;
    }
    if (!user || mode !== "fan-only") return;
    const fallback = landingPathForNonAttendee(user);
    if (fallback) {
      router.replace(fallback);
    }
  }, [user, loading, router, pathname, requireAuth, mode]);

  if (loading) {
    return <HubRedirectState label="Checking access…" />;
  }

  if (requireAuth && !user) {
    return <HubRedirectState label="Checking access…" />;
  }

  if (!user) {
    return <>{children}</>;
  }

  if (mode === "fan-only") {
    if (landingPathForNonAttendee(user)) {
      return <HubRedirectState />;
    }
    return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
  }

  const choice = preferredHubShell(user);
  return (
    <RoleShell choice={choice} user={user}>
      {children}
    </RoleShell>
  );
}
