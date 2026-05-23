import type { LegalLink } from "@/lib/legal/types";
import { LEGAL_LINKS } from "@/lib/legal/links";
import { LEGAL_DOCUMENTS } from "@/lib/legal/policies";

export type HubLegalPrefix = "/dashboard" | "/organizer" | "/admin";

export const HUB_LEGAL_SLUGS = Object.keys(LEGAL_DOCUMENTS);

export function hubLegalPrefixFromPathname(pathname: string): HubLegalPrefix {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "/admin";
  if (pathname === "/organizer" || pathname.startsWith("/organizer/")) {
    return "/organizer";
  }
  return "/dashboard";
}

export function hubLegalHref(prefix: HubLegalPrefix, slug: string): string {
  return `${prefix}/legal/${slug}`;
}

export function buildHubLegalLinks(prefix: HubLegalPrefix): LegalLink[] {
  return LEGAL_LINKS.map((link) => ({
    ...link,
    href: hubLegalHref(prefix, link.href.replace(/^\//, "")),
  }));
}

export function hubLegalBackHref(prefix: HubLegalPrefix): string {
  if (prefix === "/organizer") return "/organizer/dashboard";
  if (prefix === "/admin") return "/admin";
  return "/dashboard";
}

export function hubLegalPageTitle(pathname: string): string | null {
  const match = pathname.match(/^\/(dashboard|organizer|admin)\/legal\/([^/]+)/);
  if (!match) return null;
  const doc = LEGAL_DOCUMENTS[match[2]];
  return doc?.title ?? "Legal";
}
