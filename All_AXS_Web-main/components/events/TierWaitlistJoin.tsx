"use client";

import { useState } from "react";
import { isValidEmailFormat } from "@/lib/validation/checkout";

type Props = {
  eventId: string;
  tierId: string;
  tierName: string;
};

export function TierWaitlistJoin({ eventId, tierId, tierName }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ position: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/public/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(tierId)}/waitlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: trimmed }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        position?: number;
      };

      if (!res.ok) {
        setError(data.message || "Could not join the waitlist. Try again.");
        return;
      }

      setJoined({ position: data.position ?? 1 });
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (joined) {
    return (
      <div className="mt-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
        <p className="text-sm font-medium text-foreground">You&apos;re on the waitlist</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Position #{joined.position} for {tierName}. We&apos;ll email {email.trim()} if a ticket
          opens up — you&apos;ll have 30 minutes to complete checkout.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <p className="text-xs leading-relaxed text-muted">
        Sold out — join the waitlist and we&apos;ll email you if a ticket is returned.
      </p>
      <label className="sr-only" htmlFor={`waitlist-email-${tierId}`}>
        Email for {tierName} waitlist
      </label>
      <input
        id={`waitlist-email-${tierId}`}
        type="email"
        autoComplete="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg border border-primary/30 bg-primary/[0.08] px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.14] disabled:opacity-60"
      >
        {submitting ? "Joining…" : "Join waitlist"}
      </button>
    </form>
  );
}
