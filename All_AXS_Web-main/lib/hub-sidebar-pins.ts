import type { HubNavItem, HubNavSection } from "@/components/layout/hub/HubAppShell";
import type { HubKind } from "@/components/layout/hub/HubTopBar";

export const MAX_HUB_SIDEBAR_PINS = 8;

const STORAGE_PREFIX = "allaxs_hub_sidebar_pins";

/** Stable id for a sidebar row — href + label matches HubAppShell list keys. */
export function hubNavItemId(item: HubNavItem): string {
  return `${item.href}\0${item.label}`;
}

export function hubSidebarPinsStorageKey(userId: string, hubKind: HubKind): string {
  return `${STORAGE_PREFIX}:${userId}:${hubKind}`;
}

export function readHubSidebarPins(userId: string, hubKind: HubKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(hubSidebarPinsStorageKey(userId, hubKind));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeHubSidebarPins(
  userId: string,
  hubKind: HubKind,
  pinnedIds: string[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      hubSidebarPinsStorageKey(userId, hubKind),
      JSON.stringify(pinnedIds),
    );
  } catch {
    /* private mode / quota */
  }
}

export function toggleHubSidebarPin(current: string[], itemId: string): string[] {
  const index = current.indexOf(itemId);
  if (index >= 0) {
    return current.filter((id) => id !== itemId);
  }
  if (current.length >= MAX_HUB_SIDEBAR_PINS) {
    return current;
  }
  return [...current, itemId];
}

export type OrganizedHubNav = {
  pinnedSection: HubNavSection | null;
  sections: HubNavSection[];
};

/** Move pinned items into a dedicated top section; drop stale pin ids. */
export function organizeHubNavSections(
  sections: HubNavSection[],
  pinnedIds: string[],
): OrganizedHubNav {
  const itemById = new Map<string, HubNavItem>();
  for (const section of sections) {
    for (const item of section.items) {
      itemById.set(hubNavItemId(item), item);
    }
  }

  const validPinnedIds = pinnedIds.filter((id) => itemById.has(id));
  const pinnedSet = new Set(validPinnedIds);
  const pinnedItems = validPinnedIds.map((id) => itemById.get(id)!);

  const remainingSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !pinnedSet.has(hubNavItemId(item))),
    }))
    .filter((section) => section.items.length > 0);

  const pinnedSection =
    pinnedItems.length > 0 ? { title: "Pinned", items: pinnedItems } : null;

  return { pinnedSection, sections: remainingSections };
}

export function collectHubNavItemIds(sections: HubNavSection[]): Set<string> {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const item of section.items) {
      ids.add(hubNavItemId(item));
    }
  }
  return ids;
}
