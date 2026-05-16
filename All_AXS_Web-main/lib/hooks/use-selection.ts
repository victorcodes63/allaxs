"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Tiny selection primitive for admin list views (moderation queue, orders,
 * and future bulk-action surfaces). Keeps a `Set<string>` of selected ids
 * and offers convenience helpers that don't leak the underlying Set.
 *
 * The hook auto-prunes ids that disappear from the visible page (e.g.
 * after a refetch when an event was approved) so callers don't end up
 * with stale selections. `clear()` is provided for the post-action
 * "selection cleared" pattern.
 */
export interface SelectionApi {
  /** Snapshot of the currently selected ids (do not mutate). */
  selected: ReadonlySet<string>;
  /** Number of selected ids. */
  size: number;
  /** Whether any ids are selected. */
  anySelected: boolean;
  /** Whether *every* id from the latest items array is selected (and items is non-empty). */
  allSelected: boolean;
  /** Whether the given id is currently selected. */
  isSelected: (id: string) => boolean;
  /** Toggle a single id. */
  toggle: (id: string) => void;
  /** Force a single id on/off. */
  set: (id: string, next: boolean) => void;
  /** Select all currently-visible ids. */
  selectAll: () => void;
  /** Toggle "select all": clears if everything is selected, else selects all. */
  toggleAll: () => void;
  /** Clear every selection. */
  clear: () => void;
  /** Snapshot of selected ids as an array (stable per render). */
  ids: string[];
}

export function useSelection<T>(
  items: ReadonlyArray<T>,
  getId: (item: T) => string,
): SelectionApi {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Auto-prune ids that vanish from the visible items array. This makes
  // the post-action UX simpler: after a refetch the bulk-action banner
  // automatically dismisses if the rows have moved out of the current
  // filter.
  useEffect(() => {
    queueMicrotask(() => {
      setSelected((prev) => {
        if (prev.size === 0) return prev;
        const visible = new Set(items.map(getId));
        let changed = false;
        const next = new Set<string>();
        prev.forEach((id) => {
          if (visible.has(id)) {
            next.add(id);
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    });
  }, [items, getId]);

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const set = useCallback((id: string, nextValue: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (nextValue) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(items.map(getId)));
  }, [items, getId]);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const ids = useMemo(() => Array.from(selected), [selected]);
  const size = selected.size;
  const anySelected = size > 0;
  const allSelected = items.length > 0 && size === items.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      clear();
    } else {
      selectAll();
    }
  }, [allSelected, clear, selectAll]);

  return {
    selected,
    size,
    anySelected,
    allSelected,
    isSelected,
    toggle,
    set,
    selectAll,
    toggleAll,
    clear,
    ids,
  };
}
