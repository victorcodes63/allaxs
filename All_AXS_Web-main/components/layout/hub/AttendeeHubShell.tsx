"use client";

import { useMemo } from "react";
import { HubAppShell, type HubNavSection } from "@/components/layout/hub/HubAppShell";
import {
  normalizeWebUserRoles,
  shouldOfferOrganizerHub,
  userHasRole,
} from "@/lib/auth/hub-routing";
import { hubLegalPageTitle } from "@/lib/legal/hub-paths";

function attendeePageTitle(pathname: string): string {
  const legalTitle = hubLegalPageTitle(pathname);
  if (legalTitle) return legalTitle;

  if (pathname === "/organizer/onboarding" || pathname.startsWith("/organizer/onboarding/")) {
    return "Become a host";
  }
  if (pathname === "/organizer/team/join" || pathname.startsWith("/organizer/team/join/")) {
    return "Team invite";
  }
  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return pathname === "/dashboard/events" ? "Browse events" : "Event details";
  }
  if (pathname === "/dashboard/orders" || pathname.startsWith("/dashboard/orders/")) {
    if (pathname.endsWith("/confirmation")) return "Order confirmation";
    return pathname === "/dashboard/orders" ? "My orders" : "Order details";
  }
  if (pathname === "/dashboard/refunds" || pathname.startsWith("/dashboard/refunds/")) {
    return "My refunds";
  }
  if (pathname === "/dashboard/calendar" || pathname.startsWith("/dashboard/calendar/")) {
    return "My calendar";
  }
  if (pathname === "/dashboard/saved" || pathname.startsWith("/dashboard/saved/")) {
    return "Saved events";
  }
  if (pathname === "/dashboard/support" || pathname.startsWith("/dashboard/support/")) {
    return "Support";
  }
  if (pathname === "/dashboard/account" || pathname.startsWith("/dashboard/account/")) {
    return "Account";
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
            href: "/dashboard/orders",
            label: "My orders",
            match: (p) => p === "/dashboard/orders" || p.startsWith("/dashboard/orders/"),
          },
          {
            href: "/dashboard/refunds",
            label: "Refunds",
            match: (p) => p === "/dashboard/refunds" || p.startsWith("/dashboard/refunds/"),
          },
          {
            href: "/dashboard/calendar",
            label: "Calendar",
            match: (p) => p === "/dashboard/calendar" || p.startsWith("/dashboard/calendar/"),
          },
          {
            href: "/notifications",
            label: "Notifications",
            match: (p) => p === "/notifications" || p.startsWith("/notifications/"),
          },
          {
            href: "/dashboard/support",
            label: "Support",
            match: (p) => p === "/dashboard/support" || p.startsWith("/dashboard/support/"),
          },
          {
            href: "/dashboard/account",
            label: "Account",
            match: (p) => p === "/dashboard/account" || p.startsWith("/dashboard/account/"),
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
          {
            href: "/dashboard/saved",
            label: "Saved",
            match: (p) => p === "/dashboard/saved" || p.startsWith("/dashboard/saved/"),
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
