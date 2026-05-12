"use client";

import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { AttendeeHubShell } from "@/components/layout/hub/AttendeeHubShell";
import { landingPathForNonAttendee } from "@/lib/auth/hub-routing";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
      return;
    }
    // Pure-admin / pure-organizer accounts should never see the fan-home
    // dashboard; bounce them to their primary workspace instead.
    const fallback = landingPathForNonAttendee(user);
    if (fallback) {
      router.replace(fallback);
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Checking access…</p>
      </div>
    );
  }

  if (landingPathForNonAttendee(user)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted">Redirecting…</p>
      </div>
    );
  }

  return <AttendeeHubShell user={user}>{children}</AttendeeHubShell>;
}
