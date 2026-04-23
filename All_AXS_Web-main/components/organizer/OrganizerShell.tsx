"use client";

import { useMemo } from "react";
import {
  HubAppShell,
  type HubNavSection,
} from "@/components/layout/hub/HubAppShell";
import { organizerPageTitle } from "@/lib/organizer-nav";

type ShellUser = { name?: string; email: string };

export function OrganizerShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const sections: HubNavSection[] = useMemo(
    () => [
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
            href: "/organizer/tickets",
            label: "Tickets",
            match: (p) => p === "/organizer/tickets",
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
            href: "/organizer/account",
            label: "Account",
            match: (p) => p === "/organizer/account",
          },
        ],
      },
    ],
    [],
  );

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
