"use client";

import Link from "next/link";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { parseIntent, type AuthIntent } from "@/lib/auth/post-auth-redirect";

function intentMergeHref(
  basePath: "/login" | "/register",
  searchParams: ReadonlyURLSearchParams,
  intent: AuthIntent,
): string {
  const sp = new URLSearchParams(searchParams.toString());
  sp.set("intent", intent);
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

function segmentClass(selected: boolean) {
  return [
    "flex flex-1 items-center justify-center rounded-full px-3 py-2 text-[13px] font-semibold tracking-tight transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    selected
      ? "bg-primary text-primary-foreground shadow-[0_2px_12px_-2px_rgba(240,114,65,0.55)]"
      : "text-muted hover:text-foreground",
  ].join(" ");
}

/** Fan / host segmented control — narrow, single-column auth. */
export function AuthIntentHint({
  searchParams,
  basePath,
}: {
  searchParams: ReadonlyURLSearchParams;
  basePath: "/login" | "/register";
}) {
  const current = parseIntent(searchParams.get("intent"));
  const attendSelected = current === "attend";
  const hostSelected = current === "host";

  return (
    <div className="space-y-2" role="group" aria-label={basePath === "/register" ? "Sign up as" : "Open as"}>
      <div className="flex rounded-full border border-border/50 bg-background/50 p-1">
        <Link
          href={intentMergeHref(basePath, searchParams, "attend")}
          className={segmentClass(attendSelected)}
          aria-current={attendSelected ? "true" : undefined}
        >
          Fan
        </Link>
        <Link
          href={intentMergeHref(basePath, searchParams, "host")}
          className={segmentClass(hostSelected)}
          aria-current={hostSelected ? "true" : undefined}
        >
          Host
        </Link>
      </div>
      <p className="text-center text-[10px] tracking-wide text-muted/80">Switch anytime from the hub</p>
    </div>
  );
}
