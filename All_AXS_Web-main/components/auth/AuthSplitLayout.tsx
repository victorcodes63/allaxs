import type { ReactNode } from "react";

/**
 * Two-pane auth layout: intent rail + primary form. Mobile shows the form first, then the rail.
 */
export function AuthSplitLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-1 grid grid-cols-1 gap-9 lg:mt-0 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start lg:gap-0">
      <div className="order-2 flex min-h-0 flex-col lg:order-1 lg:pr-9">{rail}</div>
      <div className="order-1 min-w-0 lg:order-2 lg:border-l lg:border-border/45 lg:pl-9">
        {children}
      </div>
    </div>
  );
}
