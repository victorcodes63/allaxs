"use client";

import { useMemo } from "react";
import {
  HubAppShell,
  type HubNavSection,
} from "@/components/layout/hub/HubAppShell";
import { organizerPageTitle } from "@/lib/organizer-nav";

type ShellUser = { name?: string; email: string; roles?: string[] };

export function OrganizerShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const sections: HubNavSection[] = useMemo(() => {
    const base: HubNavSection[] = [
      {
        title: "Host",
        items: [
          {
            href: "/organizer/dashboard",
            label: "Overview",
            match: (p) => p === "/organizer/dashboard",
          },
          {
            href: "/organizer/sales",
            label: "Sales & orders",
            match: (p) => p === "/organizer/sales",
          },
          {
            href: "/organizer/customers",
            label: "Customers",
            match: (p) => p === "/organizer/customers",
          },
          {
            href: "/organizer/refunds",
            label: "Refunds",
            match: (p) => p === "/organizer/refunds",
          },
          {
            href: "/organizer/waitlist",
            label: "Waitlist",
            match: (p) => p === "/organizer/waitlist",
          },
          {
            href: "/organizer/earnings",
            label: "Earnings",
            match: (p) => p === "/organizer/earnings",
          },
          {
            href: "/organizer/tickets",
            label: "Tickets",
            match: (p) => p === "/organizer/tickets",
          },
          {
            href: "/organizer/tickets/scan",
            label: "Door scan",
            match: (p) => p === "/organizer/tickets/scan",
          },
          {
            href: "/organizer/events",
            label: "Events",
            match: (p) =>
              p === "/organizer/events" ||
              /^\/organizer\/events\/[^/]+\/edit$/.test(p),
          },
          {
            href: "/organizer/events/new",
            label: "New event",
            match: (p) => p === "/organizer/events/new",
          },
          {
            href: "/organizer/calendar",
            label: "Calendar",
            match: (p) => p === "/organizer/calendar",
          },
          {
            href: "/organizer/marketing",
            label: "Marketing",
            match: (p) => p === "/organizer/marketing",
          },
          {
            href: "/organizer/affiliates",
            label: "Affiliates",
            match: (p) => p === "/organizer/affiliates",
          },
          {
            href: "/organizer/store",
            label: "Store",
            match: (p) => p === "/organizer/store",
          },
          {
            href: "/organizer/team",
            label: "Team",
            match: (p) => p === "/organizer/team" || p.startsWith("/organizer/team/"),
          },
          {
            href: "/organizer/account",
            label: "Account",
            match: (p) => p === "/organizer/account",
          },
          {
            href: "/organizer/support",
            label: "Support",
            match: (p) => p === "/organizer/support",
          },
        ],
      },
    ];
    if (user.roles?.includes("ADMIN")) {
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
      brandHome="/organizer/dashboard"
      hubEyebrow="Organiser"
      hubEyebrowTone="accent"
      hubKind="organizer"
      sections={sections}
      getPageTitle={organizerPageTitle}
      user={user}
    >
      {children}
    </HubAppShell>
  );
}
