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

function intentCardClass(role: AuthIntent, current: AuthIntent | null) {
  const selected = current === role;
  const dimmed = current !== null && current !== role;

  const base =
    "group relative flex min-h-[5.75rem] flex-col rounded-[var(--radius-card)] border px-3.5 py-3 text-left transition-[opacity,filter,border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  if (selected) {
    return `${base} z-[1] border-primary/55 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(240,114,65,0.12)]`;
  }
  if (dimmed) {
    return `${base} border-border/35 bg-background/20 opacity-[0.52] grayscale-[0.2] hover:opacity-[0.88] hover:grayscale-0`;
  }
  return `${base} border-border/60 bg-background/40 hover:border-primary/35 hover:bg-background/70`;
}

/**
 * Attendee vs host path picker — left rail beside the email form on large screens.
 * Selecting one dims the other (still clickable to switch intent).
 */
export function AuthIntentHint({
  searchParams,
  basePath,
}: {
  searchParams: ReadonlyURLSearchParams;
  basePath: "/login" | "/register";
}) {
  const current = parseIntent(searchParams.get("intent"));
  const isRegister = basePath === "/register";

  const heading = isRegister ? "How will you use AllAXS?" : "Where we open first";
  const sub = isRegister
    ? "Same account either way—switch fan and host views anytime from the hub."
    : "Same credentials either way. This only sets your first screen; switch views in the hub without signing out again.";

  const attendTitle = isRegister ? "Join as a fan" : "Tickets & passes";
  const attendBody = isRegister
    ? "Buy tickets and manage passes in My tickets."
    : "Browse shows, your orders, and digital passes.";

  const hostTitle = isRegister ? "Join as a host" : "Events & sales";
  const hostBody = isRegister
    ? "Publish listings, payouts, and door check-in."
    : "Dashboard for listings, revenue, and check-in.";

  return (
    <section className="flex min-h-0 flex-col gap-4" aria-labelledby="auth-intent-heading">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Path</p>
        <h2 id="auth-intent-heading" className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{sub}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Link
          href={intentMergeHref(basePath, searchParams, "attend")}
          className={intentCardClass("attend", current)}
          aria-current={current === "attend" ? "true" : undefined}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Attendee</span>
          <span className="mt-1.5 block text-sm font-semibold leading-snug text-foreground">{attendTitle}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{attendBody}</span>
          {current === "attend" ? (
            <span className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Selected</span>
          ) : (
            <span className="mt-2.5 text-[10px] font-medium text-muted group-hover:text-foreground/75">
              {current === "host" ? "Switch to attendee" : "Choose attendee"}
            </span>
          )}
        </Link>

        <Link
          href={intentMergeHref(basePath, searchParams, "host")}
          className={intentCardClass("host", current)}
          aria-current={current === "host" ? "true" : undefined}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-dark">Host</span>
          <span className="mt-1.5 block text-sm font-semibold leading-snug text-foreground">{hostTitle}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hostBody}</span>
          {current === "host" ? (
            <span className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Selected</span>
          ) : (
            <span className="mt-2.5 text-[10px] font-medium text-muted group-hover:text-foreground/75">
              {current === "attend" ? "Switch to host" : "Choose host"}
            </span>
          )}
        </Link>
      </div>
    </section>
  );
}
