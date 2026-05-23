import { hubLegalPageTitle } from "@/lib/legal/hub-paths";

/** Labels for the organizer app chrome (sidebar + top bar). */
export function organizerPageTitle(pathname: string): string {
  const legalTitle = hubLegalPageTitle(pathname);
  if (legalTitle) return legalTitle;

  if (pathname === "/organizer/dashboard") return "Overview";
  if (pathname === "/organizer/sales") return "Sales & orders";
  if (pathname === "/organizer/earnings") return "Earnings & payouts";
  if (pathname === "/organizer/tickets") return "Tickets";
  if (pathname === "/organizer/tickets/scan") return "Door scan";
  if (pathname === "/organizer/account") return "Account";
  if (pathname === "/organizer/team") return "Team";
  if (pathname === "/organizer/team/join") return "Team invite";
  if (pathname === "/organizer/events" || pathname === "/organizer/events/")
    return "Events";
  if (pathname === "/organizer/events/new") return "Create event";
  if (/^\/organizer\/events\/[^/]+\/edit$/.test(pathname)) return "Edit event";
  if (
    pathname === "/organizer/onboarding" ||
    pathname.startsWith("/organizer/onboarding/")
  ) {
    return "Organizer setup";
  }
  return "Organizer";
}

export function organizerNavActive(href: string, pathname: string): boolean {
  if (href === "/organizer/dashboard") {
    return pathname === "/organizer/dashboard";
  }
  if (href === "/organizer/sales") {
    return pathname === "/organizer/sales";
  }
  if (href === "/organizer/earnings") {
    return pathname === "/organizer/earnings";
  }
  if (href === "/organizer/tickets") {
    return pathname === "/organizer/tickets";
  }
  if (href === "/organizer/tickets/scan") {
    return pathname === "/organizer/tickets/scan";
  }
  if (href === "/organizer/events/new") {
    return pathname === "/organizer/events/new";
  }
  if (href === "/organizer/account") {
    return pathname === "/organizer/account";
  }
  if (href === "/organizer/team") {
    return pathname === "/organizer/team" || pathname.startsWith("/organizer/team/");
  }
  if (href === "/organizer/events") {
    if (pathname === "/organizer/events" || pathname === "/organizer/events/")
      return true;
    return /^\/organizer\/events\/[^/]+\/edit$/.test(pathname);
  }
  return false;
}
