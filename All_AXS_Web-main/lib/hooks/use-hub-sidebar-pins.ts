"use client";

import { useCallback, useEffect, useState } from "react";
import type { HubNavSection } from "@/components/layout/hub/HubAppShell";
import type { HubKind } from "@/components/layout/hub/HubTopBar";
import {
  MAX_HUB_SIDEBAR_PINS,
  collectHubNavItemIds,
  hubSidebarPinsStorageKey,
  readHubSidebarPins,
  toggleHubSidebarPin,
  writeHubSidebarPins,
} from "@/lib/hub-sidebar-pins";

export function useHubSidebarPins(
  hubKind: HubKind,
  userId: string | undefined,
  sections: HubNavSection[],
) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) {
      setPinnedIds([]);
      return;
    }
    setPinnedIds(readHubSidebarPins(userId, hubKind));
  }, [userId, hubKind]);

  useEffect(() => {
    if (!userId) return;
    const storageKey = hubSidebarPinsStorageKey(userId, hubKind);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setPinnedIds(readHubSidebarPins(userId, hubKind));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId, hubKind]);

  useEffect(() => {
    if (!userId) return;
    const validIds = collectHubNavItemIds(sections);
    setPinnedIds((current) => {
      const cleaned = current.filter((id) => validIds.has(id));
      if (
        cleaned.length === current.length &&
        cleaned.every((id, index) => id === current[index])
      ) {
        return current;
      }
      writeHubSidebarPins(userId, hubKind, cleaned);
      return cleaned;
    });
  }, [userId, hubKind, sections]);

  const togglePin = useCallback(
    (itemId: string) => {
      if (!userId) return;
      setPinnedIds((current) => {
        const next = toggleHubSidebarPin(current, itemId);
        writeHubSidebarPins(userId, hubKind, next);
        return next;
      });
    },
    [userId, hubKind],
  );

  const isPinned = useCallback(
    (itemId: string) => pinnedIds.includes(itemId),
    [pinnedIds],
  );

  const pinLimitReached = pinnedIds.length >= MAX_HUB_SIDEBAR_PINS;

  return { pinnedIds, togglePin, isPinned, pinLimitReached };
}
