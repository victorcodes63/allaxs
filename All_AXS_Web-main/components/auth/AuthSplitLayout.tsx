import type { ReactNode } from "react";

/** Single-column stack: intent segment, then form (narrow premium card). */
export function AuthSplitLayout({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {rail}
      {children}
    </div>
  );
}
