"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/**
 * Shown on the fan dashboard when the account was auto-provisioned
 * during guest checkout and the buyer has not set a password yet.
 */
export function AutoCreatedAccountBanner() {
  const { user } = useAuth();
  if (!user?.autoCreatedAt) return null;

  return (
    <section
      aria-labelledby="auto-account-banner-title"
      className="rounded-[var(--radius-panel)] border border-primary/25 bg-wash p-5 md:p-6 space-y-3"
    >
      <h3
        id="auto-account-banner-title"
        className="font-display text-lg font-semibold text-foreground"
      >
        Welcome — your tickets are ready
      </h3>
      <p className="text-sm text-muted leading-relaxed max-w-2xl">
        We created an account for <span className="font-medium text-foreground">{user.email}</span>{" "}
        when you purchased. Your passes are below. Set a password for quicker sign-in next time, or
        use the secure link from your confirmation email anytime.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/tickets"
          className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
        >
          View my tickets
        </Link>
        <Link
          href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
          className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
        >
          Set a password
        </Link>
      </div>
    </section>
  );
}
