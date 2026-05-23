"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

const CONTACT_EMAIL = "hello@allaxs.com";

/** Optional social URLs — set in Vercel when accounts exist; omitted links are not shown. */
const SOCIAL_LINKS = [
  {
    label: "X",
    href: process.env.NEXT_PUBLIC_SOCIAL_X_URL?.trim(),
  },
  {
    label: "LinkedIn",
    href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL?.trim(),
  },
  {
    label: "Instagram",
    href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim(),
  },
].filter((item): item is { label: string; href: string } => Boolean(item.href));

const STATIC_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: `mailto:${CONTACT_EMAIL}`, label: "Email", external: true },
  { href: "/events", label: "Events" },
  { href: "/organizers", label: "For organizers" },
];

const linkClassName =
  "text-sm font-medium text-foreground/70 underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-primary/90";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * Footer "Stay in the loop" band — accessible newsletter capture that posts to
 * `/api/newsletter/subscribe`. Falls back to a friendly success state in dev
 * when Resend Audiences env vars are not configured.
 */
export function FooterStayInTheLoop() {
  const formId = useId();
  const emailInputId = `${formId}-email`;
  const messageId = `${formId}-message`;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "submitting") return;

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus({ kind: "error", message: "Please enter your email." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (res.ok && data?.ok !== false) {
        setStatus({
          kind: "success",
          message: data?.message ?? "Thanks — you're on the list.",
        });
        setEmail("");
        return;
      }
      setStatus({
        kind: "error",
        message:
          data?.message ??
          "We couldn't subscribe that address. Please try again.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  const submitting = status.kind === "submitting";
  const succeeded = status.kind === "success";

  return (
    <div className="min-w-0 max-w-3xl text-left" aria-labelledby="footer-follow-label">
      <p
        id="footer-follow-label"
        className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45"
      >
        Stay in the loop
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/60">
        Product updates and event drops, straight to your inbox. No spam — unsubscribe any time.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-describedby={status.kind === "idle" ? undefined : messageId}
        className="mt-4 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3"
      >
        <label htmlFor={emailInputId} className="sr-only">
          Email address
        </label>
        <input
          id={emailInputId}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status.kind === "error" || status.kind === "success") {
              setStatus({ kind: "idle" });
            }
          }}
          disabled={submitting || succeeded}
          aria-invalid={status.kind === "error" || undefined}
          className="flex-1 min-h-[3.25rem] rounded-[var(--radius-button)] border border-white/10 bg-white/[0.04] px-4 text-sm text-foreground placeholder:text-foreground/40 transition focus:border-primary/60 focus:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--footer-panel-bg)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting || succeeded}
          className="axs-bg-brand-gradient inline-flex min-h-[3.25rem] items-center justify-center rounded-[var(--radius-button)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--footer-panel-bg)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100"
        >
          {submitting ? "Subscribing…" : succeeded ? "Subscribed" : "Subscribe"}
        </button>
      </form>

      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={[
          "mt-2 min-h-[1.25rem] text-xs leading-relaxed",
          status.kind === "error"
            ? "text-primary"
            : status.kind === "success"
              ? "text-foreground/80"
              : "text-foreground/45",
        ].join(" ")}
      >
        {status.kind === "success" || status.kind === "error" ? status.message : ""}
      </p>

      <nav
        className="mt-5 flex flex-wrap gap-x-4 gap-y-2"
        aria-label="Follow All AXS"
      >
        {STATIC_LINKS.map(({ href, label, external }) =>
          external ? (
            <a key={href} href={href} className={linkClassName}>
              {label}
            </a>
          ) : (
            <Link key={href} href={href} className={linkClassName}>
              {label}
            </Link>
          ),
        )}
        {SOCIAL_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={linkClassName}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        ))}
      </nav>
      <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">
        Account and purchase data are described in our{" "}
        <Link
          href="/privacy"
          className="font-medium text-foreground/55 underline hover:text-primary/85"
        >
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
