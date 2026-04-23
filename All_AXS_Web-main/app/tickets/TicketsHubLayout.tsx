"use client";

import { useAuth } from "@/lib/auth";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";

export function TicketsHubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
  }

  return <>{children}</>;
}
