"use client";

import { useAuth } from "@/lib/auth";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import { AdminShell } from "@/components/admin/AdminShell";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { preferredHubShell } from "@/lib/auth/hub-routing";

export function NotificationsHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  const choice = preferredHubShell(user);
  if (choice === "admin") {
    return <AdminShell user={user}>{children}</AdminShell>;
  }
  if (choice === "organizer") {
    return <OrganizerShell user={user}>{children}</OrganizerShell>;
  }
  return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
}
