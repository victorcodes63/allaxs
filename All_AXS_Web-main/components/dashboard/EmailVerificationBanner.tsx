"use client";

import Link from "next/link";
import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";

const RESEND_SUCCESS =
  "If your account is not verified yet, a new verification email has been sent.";

/**
 * Soft gate: signed-in users can browse, but we remind them to verify email
 * before purchases or sensitive actions.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified === true) return null;

  const onResend = async () => {
    setSending(true);
    setSent(false);
    try {
      await axios.post("/api/auth/resend-verification", { email: user.email });
    } catch {
      /* API returns generic success even on errors */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  return (
    <section
      aria-labelledby="email-verify-banner-title"
      className="rounded-[var(--radius-panel)] border border-primary/25 bg-wash p-5 md:p-6 space-y-3"
    >
      <h3
        id="email-verify-banner-title"
        className="font-display text-lg font-semibold text-foreground"
      >
        Verify your email
      </h3>
      <p className="text-sm text-muted leading-relaxed max-w-2xl">
        We sent a confirmation link to{" "}
        <span className="font-medium text-foreground">{user.email}</span>. Open it to
        secure your account and unlock checkout. You can still browse events in the
        meantime.
      </p>
      {sent ? (
        <p className="text-sm text-green-700">{RESEND_SUCCESS}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={sending}
          className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend verification email"}
        </button>
        <Link
          href="/check-email"
          className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
        >
          What to do next
        </Link>
      </div>
    </section>
  );
}
