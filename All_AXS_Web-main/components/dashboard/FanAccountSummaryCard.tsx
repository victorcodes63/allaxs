"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { userInitials } from "@/lib/hub-user";

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

type FanAccountSummaryCardProps = {
  compact?: boolean;
};

export function FanAccountSummaryCard({ compact = false }: FanAccountSummaryCardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <aside
        aria-label="Account summary"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
      >
        <p className="text-sm text-muted">Loading account…</p>
      </aside>
    );
  }

  if (!user) return null;

  const memberSince = formatMemberSince(user.createdAt);
  const initials = userInitials(user);

  return (
    <aside
      aria-label="Account summary"
      className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        Your account
      </p>
      <div className="mt-4 flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground ring-2 ring-primary/10"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">
            {user.name?.trim() || "Member"}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
          {user.phone?.trim() ? (
            <p className="mt-1 text-sm text-muted">{user.phone.trim()}</p>
          ) : null}
        </div>
      </div>

      <dl className={`mt-5 space-y-3 text-sm ${compact ? "" : "border-t border-border/70 pt-5"}`}>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-xs font-medium text-muted">Email verified</dt>
          <dd className="font-medium text-foreground">
            {user.emailVerified ? "Yes" : "Pending"}
          </dd>
        </div>
        {memberSince ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs font-medium text-muted">Member since</dt>
            <dd className="font-medium text-foreground">{memberSince}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/dashboard/account"
          className="inline-flex min-h-[var(--btn-min-h)] flex-1 items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
        >
          Manage account
        </Link>
        {!compact ? (
          <Link
            href="/dashboard"
            className="inline-flex min-h-[var(--btn-min-h)] flex-1 items-center justify-center rounded-[var(--radius-button)] border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/45"
          >
            Overview
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
