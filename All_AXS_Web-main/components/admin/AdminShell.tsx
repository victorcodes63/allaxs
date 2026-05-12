"use client";

import { useMemo } from "react";
import {
  HubAppShell,
  type HubNavSection,
} from "@/components/layout/hub/HubAppShell";

type ShellUser = { name?: string; email: string; roles?: string[] };

function adminPageTitle(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") {
    return "Admin overview";
  }
  if (pathname === "/admin/events") {
    return "All events";
  }
  if (pathname.startsWith("/admin/events/")) return "Event details";
  if (pathname === "/admin/orders" || pathname.startsWith("/admin/orders/")) {
    return "Orders";
  }
  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
    return "Users";
  }
  if (pathname === "/admin/moderation" || pathname.startsWith("/admin/moderation")) {
    return "Moderation queue";
  }
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
    return "Notifications";
  }
  return "Admin";
}

export function AdminShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const sections: HubNavSection[] = useMemo(
    () => [
      {
        title: "Admin",
        items: [
          {
            href: "/admin",
            label: "Overview",
            match: (p) => p === "/admin" || p === "/admin/",
          },
          {
            href: "/admin/events",
            label: "All events",
            match: (p) =>
              p === "/admin/events" || p.startsWith("/admin/events/"),
          },
          {
            href: "/admin/orders",
            label: "Orders",
            match: (p) =>
              p === "/admin/orders" || p.startsWith("/admin/orders/"),
          },
          {
            href: "/admin/users",
            label: "Users",
            match: (p) =>
              p === "/admin/users" || p.startsWith("/admin/users/"),
          },
          {
            href: "/admin/moderation",
            label: "Moderation queue",
            match: (p) =>
              p === "/admin/moderation" || p.startsWith("/admin/moderation/"),
          },
          {
            href: "/notifications",
            label: "Notifications",
            match: (p) =>
              p === "/notifications" || p.startsWith("/notifications/"),
          },
        ],
      },
    ],
    [],
  );

  return (
    <HubAppShell
      brandHome="/admin"
      hubEyebrow="Admin"
      hubEyebrowTone="accent"
      hubKind="admin"
      sections={sections}
      getPageTitle={adminPageTitle}
      user={user}
    >
      {children}
    </HubAppShell>
  );
}
