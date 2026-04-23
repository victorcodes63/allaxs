"use client";

import { useState } from "react";

/**
 * Compact newsletter for the footer band (single row with underline email + small notify).
 */
export function FooterStayInTheLoop() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="min-w-0 max-w-3xl text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45">Stay in the loop</p>
        <p className="mt-2 text-sm font-medium text-foreground/75" role="status">
          Thanks—you&apos;re on the list.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-3xl text-left" aria-labelledby="footer-stay-label">
      <p id="footer-stay-label" className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45">
        Stay in the loop
      </p>
      <form
        className="mt-2 flex flex-col gap-2.5 sm:mt-3 sm:flex-row sm:items-end sm:gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <label htmlFor="footer-news-compact" className="sr-only">
          Email for updates
        </label>
        <div className="min-w-0 flex-1 border-b border-foreground/25 pb-1.5 transition-colors focus-within:border-primary/50">
          <input
            id="footer-news-compact"
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-foreground/40 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-[var(--radius-button)] bg-primary px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-primary-dark sm:py-2"
        >
          Notify
        </button>
      </form>
    </div>
  );
}
