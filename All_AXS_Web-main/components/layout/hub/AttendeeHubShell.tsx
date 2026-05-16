"use client";

import { useMemo } from "react";
import { HubAppShell, type HubNavSection } from "@/components/layout/hub/HubAppShell";
import {
  normalizeWebUserRoles,
  shouldOfferOrganizerHub,
  userHasRole,
} from "@/lib/auth/hub-routing";

function attendeePageTitle(pathname: string): string {
  if (pathname === "/organizer/onboarding" || pathname.startsWith("/organizer/onboarding/")) {
    return "Become a host";
  }
  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return "Browse events";
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "Overview";
  }
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
    return "Notifications";
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
            match: (p) => p === "/dashboard",
          },
          {
            href: "/tickets",
            label: "My tickets",
            match: (p) => p === "/tickets" || p.startsWith("/tickets/"),
          },
          {
            href: "/notifications",
            label: "Notifications",
            match: (p) => p === "/notifications" || p.startsWith("/notifications/"),
          },
        ],
      },
      {
        title: "Discover",
        items: [
          {
            href: "/dashboard/events",
            label: "Browse events",
            match: (p) => p === "/dashboard/events" || p.startsWith("/dashboard/events/"),
          },
        ],
      },
    ];
    if (shouldOfferOrganizerHub(normalizeWebUserRoles(user.roles))) {
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
    if (userHasRole(user, "ADMIN")) {
      base.push({
        title: "Moderation",
        items: [
          {
            href: "/admin",
            label: "Admin overview",
            match: (p) => p === "/admin" || p.startsWith("/admin/"),
          },
        ],
      });
    }
    return base;
  }, [user.roles]);

  return (
    <HubAppShell
      brandHome="/dashboard"
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
