"use client";

import Link from "next/link";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { parseIntent, type AuthIntent } from "@/lib/auth/post-auth-redirect";

function intentMergeHref(
  basePath: "/login" | "/register",
  searchParams: ReadonlyURLSearchParams,
  intent: AuthIntent | null,
): string {
  const sp = new URLSearchParams(searchParams.toString());
  if (intent) sp.set("intent", intent);
  else sp.delete("intent");
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function AuthIntentHint({
  searchParams,
  basePath,
}: {
  searchParams: ReadonlyURLSearchParams;
  basePath: "/login" | "/register";
}) {
  const current = parseIntent(searchParams.get("intent"));
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center text-xs text-muted">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-foreground/45">
        After sign-in
      </span>
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-foreground/85">
        <Link
          href={intentMergeHref(basePath, searchParams, "attend")}
          className={
            current === "attend" ? "font-semibold text-primary" : "text-foreground/80 hover:text-primary"
          }
        >
          Browse events
        </Link>
        <span className="text-foreground/25">·</span>
        <Link
          href={intentMergeHref(basePath, searchParams, "host")}
          className={
            current === "host" ? "font-semibold text-primary" : "text-foreground/80 hover:text-primary"
          }
        >
          Host events
        </Link>
        {current ? (
          <>
            <span className="text-foreground/25">·</span>
            <Link
              href={intentMergeHref(basePath, searchParams, null)}
              className="text-muted underline-offset-2 hover:text-foreground"
            >
              Clear
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
