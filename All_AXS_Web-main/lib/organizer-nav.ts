/** Labels for the organizer app chrome (sidebar + top bar). */
export function organizerPageTitle(pathname: string): string {
  if (pathname === "/organizer/dashboard") return "Overview";
  if (pathname === "/organizer/sales") return "Sales & orders";
  if (pathname === "/organizer/tickets") return "Tickets";
  if (pathname === "/organizer/account") return "Account";
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
  if (href === "/organizer/tickets") {
    return pathname === "/organizer/tickets";
  }
  if (href === "/organizer/events/new") {
    return pathname === "/organizer/events/new";
  }
  if (href === "/organizer/account") {
    return pathname === "/organizer/account";
  }
  if (href === "/organizer/events") {
    if (pathname === "/organizer/events" || pathname === "/organizer/events/")
      return true;
    return /^\/organizer\/events\/[^/]+\/edit$/.test(pathname);
  }
  return false;
}
