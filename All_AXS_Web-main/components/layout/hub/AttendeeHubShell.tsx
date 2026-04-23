"use client";

import { useMemo } from "react";
import { HubAppShell, type HubNavSection } from "@/components/layout/hub/HubAppShell";

function attendeePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "Overview";
  }
  if (pathname === "/tickets" || pathname.startsWith("/tickets/")) {
    return pathname === "/tickets" || pathname === "/tickets/" ? "My tickets" : "Pass details";
  }
  return "Account";
}

type User = { name?: string; email: string; roles?: string[] };

export function AttendeeHubShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const sections: HubNavSection[] = useMemo(() => {
    const base: HubNavSection[] = [
      {
        title: "Your tickets",
        items: [
          {
            href: "/dashboard",
            label: "Overview",
            match: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
          },
          {
            href: "/tickets",
            label: "My tickets",
            match: (p) => p === "/tickets" || p.startsWith("/tickets/"),
          },
        ],
      },
      {
        title: "Discover",
        items: [
          {
            href: "/events",
            label: "Browse events",
            match: (p) => p === "/events" || p.startsWith("/events/"),
          },
        ],
      },
    ];
    if (user.roles?.includes("ORGANIZER") || user.roles?.includes("ADMIN")) {
      base.push({
        title: "Host",
        items: [
          {
            href: "/organizer/dashboard",
            label: "Organizer hub",
            match: (p) => p === "/organizer" || p.startsWith("/organizer/"),
          },
        ],
      });
    }
    return base;
  }, [user.roles]);

  return (
    <HubAppShell
      brandHome="/dashboard"
      brandSubtitle="Your account"
      hubEyebrow="Fan home"
      hubKind="attendee"
      sections={sections}
      getPageTitle={attendeePageTitle}
      user={user}
    >
      {children}
    </HubAppShell>
  );
}
