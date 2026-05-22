import type { NotificationCategory } from "@/lib/notifications-inbox";

export type NotificationHubContext = "attendee" | "organizer" | "admin";

const HUB_PATH_PREFIXES = [
  "/dashboard",
  "/organizer",
  "/admin",
  "/tickets",
  "/notifications",
] as const;

function isHubInternalPath(pathname: string): boolean {
  return HUB_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function categoryFallback(
  hub: NotificationHubContext,
  category: NotificationCategory,
): string | null {
  if (category === "hosting") {
    if (hub === "admin") return "/admin/events";
    if (hub === "organizer") return "/organizer/events";
    return "/dashboard";
  }
  if (category === "orders") {
    if (hub === "admin") return "/admin/orders";
    if (hub === "organizer") return "/organizer/sales";
    return "/tickets";
  }
  if (hub === "admin") return "/admin";
  if (hub === "organizer") return "/organizer/dashboard";
  return "/dashboard";
}

function rewritePublicEventPath(
  pathname: string,
  hub: NotificationHubContext,
  category: NotificationCategory,
  organizerSlugToId?: Record<string, string>,
): string | null {
  const slugDetail = pathname.match(/^\/e\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (slugDetail) {
    const slug = decodeURIComponent(slugDetail[1]);
    const sub = slugDetail[2];
    if (hub === "organizer") {
      const eventId = organizerSlugToId?.[slug];
      if (eventId) {
        return `/organizer/events/${encodeURIComponent(eventId)}/edit`;
      }
      return "/organizer/events";
    }
    if (hub === "admin") return "/admin/events";
    if (sub === "checkout") {
      return `/dashboard/events/${encodeURIComponent(slug)}/checkout`;
    }
    return `/dashboard/events/${encodeURIComponent(slug)}`;
  }

  const eventsPath = pathname.match(/^\/events(?:\/([^/?#]+)(?:\/([^/?#]+))?)?/);
  if (eventsPath) {
    const segment = eventsPath[1];
    const sub = eventsPath[2];
    if (!segment) {
      if (hub === "organizer") return "/organizer/events";
      if (hub === "admin") return "/admin/events";
      return "/dashboard/events";
    }
    if (hub === "organizer") {
      if (sub === "checkout") return "/organizer/sales";
      return `/organizer/events/${encodeURIComponent(segment)}/edit`;
    }
    if (hub === "admin") {
      return `/admin/events/${encodeURIComponent(segment)}`;
    }
    if (sub === "checkout") return "/dashboard/events";
    return "/dashboard/events";
  }

  if (pathname === "/" || pathname.startsWith("/organizers")) {
    return categoryFallback(hub, category);
  }

  return null;
}

/**
 * Maps API notification links to signed-in hub routes only. Public catalogue
 * paths (`/e/*`, `/events/*`) and off-origin URLs never pass through.
 */
export function resolveNotificationLink(
  raw: string | undefined,
  options: {
    hub: NotificationHubContext;
    category: NotificationCategory;
    origin?: string;
    /** Organizer inventory slug → id; resolves `/e/{slug}` to event edit. */
    organizerSlugToId?: Record<string, string>;
  },
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let path = trimmed;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const allowedOrigin =
        options.origin ??
        (typeof window !== "undefined" ? window.location.origin : null);
      if (!allowedOrigin || url.origin !== allowedOrigin) {
        return categoryFallback(options.hub, options.category);
      }
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return categoryFallback(options.hub, options.category);
    }
  }

  if (!path.startsWith("/")) {
    return categoryFallback(options.hub, options.category);
  }

  const pathname = path.split(/[?#]/)[0] ?? path;
  if (isHubInternalPath(pathname)) return path;

  const rewritten = rewritePublicEventPath(
    pathname,
    options.hub,
    options.category,
    options.organizerSlugToId,
  );
  if (rewritten) return rewritten;

  return categoryFallback(options.hub, options.category);
}
