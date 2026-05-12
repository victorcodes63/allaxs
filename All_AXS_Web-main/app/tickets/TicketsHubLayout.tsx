"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import { landingPathForNonAttendee } from "@/lib/auth/hub-routing";

export function TicketsHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const fallback = landingPathForNonAttendee(user);
    if (fallback) {
      router.replace(fallback);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  if (landingPathForNonAttendee(user)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Redirecting…</p>
      </div>
    );
  }

  return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
}
