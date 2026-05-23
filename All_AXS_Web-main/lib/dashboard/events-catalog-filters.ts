import { HOME_GENRE_LINKS, buildQuickFilterLinks } from "@/lib/home/derived-events";

export type EventsCatalogFilterParams = {
  q?: string;
  type?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type CatalogFilterLink = {
  label: string;
  href: string;
};

const DASHBOARD_EVENTS_BASE = "/dashboard/events";

export function buildDashboardQuickFilterLinks(now = new Date()): CatalogFilterLink[] {
  return buildQuickFilterLinks(now).map((item) => ({
    label: item.label,
    href: item.href.replace(/^\/events/, DASHBOARD_EVENTS_BASE),
  }));
}

export function buildDashboardGenreLinks(): CatalogFilterLink[] {
  return HOME_GENRE_LINKS.map((item) => ({
    label: item.label,
    href: item.href.replace(/^\/events/, DASHBOARD_EVENTS_BASE),
  }));
}

/** True when every query param on the filter link matches the current catalogue params. */
export function isCatalogFilterActive(
  filterHref: string,
  current: EventsCatalogFilterParams,
): boolean {
  try {
    const url = new URL(filterHref, "https://allaxs.local");
    const expected = url.searchParams;
    if ([...expected.keys()].length === 0) return false;

    for (const [key, value] of expected.entries()) {
      const currentValue = current[key as keyof EventsCatalogFilterParams];
      if ((currentValue ?? "") !== value) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function activeCatalogFilterLabels(
  quick: CatalogFilterLink[],
  genre: CatalogFilterLink[],
  current: EventsCatalogFilterParams,
): string[] {
  const labels: string[] = [];
  for (const item of [...quick, ...genre]) {
    if (isCatalogFilterActive(item.href, current)) labels.push(item.label);
  }
  if (current.q?.trim() && !labels.some((l) => genre.some((g) => g.label === l))) {
    const genreMatch = genre.find((g) => isCatalogFilterActive(g.href, current));
    if (!genreMatch) labels.push(`“${current.q.trim()}”`);
  }
  if (current.city?.trim()) labels.push(current.city.trim());
  return labels;
}
