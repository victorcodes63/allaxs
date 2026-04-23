"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";

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
      router.replace(
        `/login?next=${encodeURIComponent(pathname || "/organizer/dashboard")}`,
      );
      return;
    }
    const canOrganizerApp =
      user.roles?.includes("ORGANIZER") || user.roles?.includes("ADMIN");
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

  const canOrganizerApp =
    user.roles?.includes("ORGANIZER") || user.roles?.includes("ADMIN");
  if (!onOnboarding && !canOrganizerApp) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted">Redirecting…</p>
      </div>
    );
  }

  if (onOnboarding) {
    return <>{children}</>;
  }

  return <OrganizerShell user={user}>{children}</OrganizerShell>;
}
