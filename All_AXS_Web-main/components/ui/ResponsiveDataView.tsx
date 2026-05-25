"use client";

import type { ReactNode } from "react";

type ResponsiveDataViewProps = {
  /** Desktop table (shown from `md` and up). Wrap your `<table>` in a scroll container if needed. */
  table: ReactNode;
  /** Stacked cards for viewports below `md`. */
  mobile: ReactNode;
  /** Breakpoint class prefix; default hides table below md. */
  tableClassName?: string;
  mobileClassName?: string;
};

/**
 * Standard pattern: scrollable table on tablet+, card list on phones.
 * @see app/(protected)/dashboard/refunds/page.tsx
 */
export function ResponsiveDataView({
  table,
  mobile,
  tableClassName = "hidden md:block",
  mobileClassName = "grid gap-4 md:hidden",
}: ResponsiveDataViewProps) {
  return (
    <>
      <div className={tableClassName}>{table}</div>
      <div className={mobileClassName}>{mobile}</div>
    </>
  );
}
