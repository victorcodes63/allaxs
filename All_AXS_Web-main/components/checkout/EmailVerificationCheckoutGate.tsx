"use client";

import Link from "next/link";
import { useState } from "react";
import axios from "axios";

const RESEND_SUCCESS =
  "If your account is not verified yet, a new verification email has been sent.";

/**
 * Soft gate shown on checkout when a signed-in buyer has not verified email.
 */
export function EmailVerificationCheckoutGate({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onResend = async () => {
    setSending(true);
    setSent(false);
    try {
      await axios.post("/api/auth/resend-verification", { email });
    } catch {
      /* API returns generic success even on errors */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  return (
    <section
      aria-labelledby="checkout-email-verify-title"
      className="rounded-[var(--radius-panel)] border border-primary/25 bg-wash p-6 md:p-8 space-y-4"
    >
      <h2
        id="checkout-email-verify-title"
        className="font-display text-lg font-semibold text-foreground"
      >
        Verify your email to continue
      </h2>
      <p className="text-sm text-muted leading-relaxed max-w-xl">
        We sent a confirmation link to{" "}
        <span className="font-medium text-foreground">{email}</span>. Open it to
        unlock checkout, then return here to complete your purchase.
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
          Check your inbox
        </Link>
      </div>
    </section>
  );
}
