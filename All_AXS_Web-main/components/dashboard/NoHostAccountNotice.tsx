"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function NoHostAccountNoticeContent() {
  const searchParams = useSearchParams();
  if (searchParams.get("notice") !== "noHostAccount") return null;

  return (
    <div
      className="rounded-[var(--radius-panel)] border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100"
      role="status"
    >
      No host account exists for this email. Use the{" "}
      <strong className="font-semibold text-foreground">Fan</strong> tab to sign in for
      tickets, or{" "}
      <Link href="/register?intent=host" className="font-semibold text-primary underline">
        sign up as a host
      </Link>{" "}
      to publish events.
    </div>
  );
}

export function NoHostAccountNotice() {
  return (
    <Suspense fallback={null}>
      <NoHostAccountNoticeContent />
    </Suspense>
  );
}
