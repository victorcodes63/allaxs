"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PublicEvent } from "@/lib/utils/api-server";
import { getEventBannerUrl, generatePlaceholderImage } from "@/lib/utils/image";
import { saveOrderSnapshot, type CheckoutLineItem } from "@/lib/checkout-storage";
import { ArrowButton } from "@/components/ui/ArrowCta";

function tierAvailable(tier: NonNullable<PublicEvent["ticketTypes"]>[0]) {
  if (tier.status && tier.status !== "ACTIVE") return false;
  const total = tier.quantityTotal ?? 0;
  const sold = tier.quantitySold ?? 0;
  return total - sold > 0;
}

function remaining(tier: NonNullable<PublicEvent["ticketTypes"]>[0]) {
  const total = tier.quantityTotal ?? 0;
  const sold = tier.quantitySold ?? 0;
  return Math.max(0, total - sold);
}

export function CheckoutExperience({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const tiers = useMemo(
    () => event.ticketTypes?.filter(tierAvailable) ?? [],
    [event.ticketTypes]
  );
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    tiers.forEach((t) => {
      init[t.id] = 0;
    });
    return init;
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lineItems: CheckoutLineItem[] = useMemo(() => {
    return tiers
      .filter((t) => (qty[t.id] ?? 0) > 0)
      .map((t) => ({
        ticketTypeId: t.id,
        name: t.name,
        quantity: qty[t.id] ?? 0,
        unitPriceCents: t.priceCents,
        currency: t.currency,
      }));
  }, [tiers, qty]);

  const subtotal = lineItems.reduce(
    (s, li) => s + li.unitPriceCents * li.quantity,
    0
  );
  const currency = tiers[0]?.currency ?? "KES";

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);

  const adjust = (tierId: string, delta: number, max: number, minPer: number, maxPer?: number) => {
    setQty((prev) => {
      const cur = prev[tierId] ?? 0;
      const cap = Math.min(max, maxPer ?? max);
      const next = Math.max(0, Math.min(cap, cur + delta));
      if (delta > 0 && next < minPer && next > 0) return { ...prev, [tierId]: minPer };
      return { ...prev, [tierId]: next };
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (lineItems.length === 0) {
      setError("Choose at least one ticket.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      setError("Enter a valid email.");
      return;
    }

    for (const t of tiers) {
      const q = qty[t.id] ?? 0;
      if (q === 0) continue;
      const min = t.minPerOrder ?? 1;
      const max = t.maxPerOrder;
      const rem = remaining(t);
      if (q < min) {
        setError(`${t.name}: minimum ${min} per order.`);
        return;
      }
      if (max && q > max) {
        setError(`${t.name}: maximum ${max} per order.`);
        return;
      }
      if (q > rem) {
        setError(`${t.name}: only ${rem} seats left.`);
        return;
      }
    }

    setSubmitting(true);
    const orderId = crypto.randomUUID();
    const snapshot = {
      orderId,
      createdAt: new Date().toISOString(),
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      buyerName: name.trim(),
      buyerEmail: email.trim(),
      buyerPhone: phone.trim() || undefined,
      lineItems,
      totalCents: subtotal,
      currency,
    };
    saveOrderSnapshot(snapshot);
    router.push(`/orders/${orderId}/confirmation`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-14 items-start pb-12">
      <div>
        <Link
          href={`/e/${event.slug}`}
          className="text-sm font-medium text-muted hover:text-primary transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Event details
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-tight">
          Checkout
        </h1>
        <p className="text-muted mt-2 max-w-xl">
          Review your tiers, tell us who to send the QR to, and confirm. Payment rails plug in here
          next—today we complete your reservation locally for UI flow.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-10">
          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Tickets</h2>
            {tiers.length === 0 ? (
              <p className="text-muted">This event has no tickets available.</p>
            ) : (
              <ul className="space-y-4">
                {tiers.map((tier) => {
                  const q = qty[tier.id] ?? 0;
                  const rem = remaining(tier);
                  const minP = tier.minPerOrder ?? 1;
                  const maxP = tier.maxPerOrder;
                  return (
                    <li
                      key={tier.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 border-b border-border last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{tier.name}</p>
                        <p className="text-sm text-muted mt-0.5">
                          {tier.priceCents / 100} {tier.currency} · {rem} available
                          {maxP ? ` · max ${maxP} / order` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            adjust(tier.id, -1, rem, minP, maxP)
                          }
                          className="h-10 w-10 rounded-[var(--radius-button)] border border-border text-lg font-medium hover:bg-background transition-colors"
                          aria-label="Decrease"
                        >
                          −
                      </button>
                        <span className="w-8 text-center font-semibold tabular-nums">{q}</span>
                        <button
                          type="button"
                          onClick={() =>
                            adjust(tier.id, 1, rem, minP, maxP)
                          }
                          disabled={q >= Math.min(rem, maxP ?? rem)}
                          className="h-10 w-10 rounded-[var(--radius-button)] border border-border text-lg font-medium hover:bg-background transition-colors disabled:opacity-40"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Buyer</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Full name
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoComplete="name"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Email
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoComplete="email"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Phone (optional)
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoComplete="tel"
                />
              </label>
            </div>
          </section>

          {error && (
            <div className="rounded-[var(--radius-card)] border border-primary/30 bg-wash px-4 py-3 text-sm text-primary-dark">
              {error}
            </div>
          )}

          <ArrowButton
            type="submit"
            disabled={submitting || tiers.length === 0}
            className="w-full sm:w-auto"
          >
            {submitting ? "Processing…" : `Pay ${subtotal / 100} ${currency}`}
          </ArrowButton>
          <p className="text-xs text-muted max-w-md">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              privacy policy
            </Link>
            .
          </p>
        </form>
      </div>

      <aside className="lg:sticky lg:top-24 rounded-[var(--radius-panel)] border border-border bg-surface overflow-hidden shadow-sm">
        <div className="relative h-40 bg-foreground/5">
          {event.bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized={bannerUrl.startsWith("data:")}
            />
          ) : (
            <Image
              src={placeholderUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized={placeholderUrl.startsWith("data:")}
            />
          )}
        </div>
        <div className="p-6 space-y-4">
          <h3 className="font-display font-semibold text-lg text-foreground line-clamp-2">{event.title}</h3>
          <dl className="text-sm space-y-2 text-muted">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {subtotal / 100} {currency}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Fees</dt>
              <dd className="text-muted">Calculated at payment</dd>
            </div>
            <div className="flex justify-between gap-4 pt-2 border-t border-border text-foreground font-semibold">
              <dt>Due today</dt>
              <dd className="tabular-nums">
                {subtotal / 100} {currency}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
