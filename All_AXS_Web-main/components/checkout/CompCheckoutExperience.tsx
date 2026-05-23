"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CompLinkPreview } from "@/lib/types/comp-link";
import { getEventBannerUrl, generatePlaceholderImage } from "@/lib/utils/image";
import {
  clearCheckoutDraft,
  saveOrderForSession,
  saveOrderSnapshot,
  type StoredOrder,
} from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { isValidEmailFormat } from "@/lib/validation/checkout";
import { ArrowButton } from "@/components/ui/ArrowCta";

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function CompCheckoutExperience({
  preview,
  compToken,
  context = "public",
}: {
  preview: CompLinkPreview;
  compToken: string;
  context?: "public" | "dashboard";
}) {
  const router = useRouter();
  const { event, tier, quantity } = preview;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);
  const lineItems = [
    {
      ticketTypeId: tier.id,
      name: tier.name,
      quantity,
      unitPriceCents: tier.priceCents,
      currency: tier.currency,
    },
  ];
  const subtotal = tier.priceCents * quantity;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim() || !isValidEmailFormat(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      if (!isApiCheckoutEnabled()) {
        setError("Live checkout is not enabled in this environment.");
        return;
      }

      const res = await fetch("/api/checkout/guest/comp/init", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: event.slug,
          compToken,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
        orderId?: string;
        status?: "PAID" | "AUTH_REQUIRED";
        discountCents?: number;
        amountCents?: number;
      };

      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || "Comp checkout failed";
        setError(msg);
        return;
      }

      if (data.status !== "PAID" || !data.orderId) {
        setError("Could not complete your complimentary ticket.");
        return;
      }

      const discount =
        typeof data.discountCents === "number" ? data.discountCents : subtotal;
      const paid: StoredOrder = {
        orderId: data.orderId,
        createdAt: new Date().toISOString(),
        eventId: event.id,
        eventSlug: event.slug,
        eventTitle: event.title,
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        buyerPhone: phone.trim() || undefined,
        lineItems,
        totalCents: 0,
        currency: tier.currency,
        subtotalCents: subtotal,
        discountCents: discount,
        guestCheckout: true,
        ticketDelivery: "account",
      };
      saveOrderForSession(paid);
      saveOrderSnapshot(paid);
      clearCheckoutDraft();
      router.push(
        context === "dashboard"
          ? `/dashboard/orders/${data.orderId}/confirmation`
          : `/orders/${data.orderId}/confirmation`,
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="axs-content-inner mx-auto max-w-3xl space-y-8 pb-16 pt-6">
      <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
        <div className="relative h-40 w-full sm:h-48">
          <Image
            src={event.bannerUrl ? bannerUrl : placeholderUrl}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
              Complimentary access
            </p>
            <h1 className="font-display text-2xl font-semibold">{event.title}</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 p-6 md:p-8">
          <section className="rounded-[var(--radius-card)] border border-border bg-background/40 p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {tier.name}
            </h2>
            {tier.description && (
              <p className="mt-1 text-sm text-muted">{tier.description}</p>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Quantity</dt>
                <dd className="font-medium text-foreground">{quantity}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Listed value</dt>
                <dd className="font-medium text-foreground line-through opacity-60">
                  {formatPrice(subtotal, tier.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Your total</dt>
                <dd className="font-display text-lg font-semibold text-primary">
                  {formatPrice(0, tier.currency)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Your details
            </h2>
            <p className="text-sm text-muted">
              We&apos;ll email your ticket to this address. No payment is required for
              this complimentary pass.
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[var(--radius-button)] border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                autoComplete="name"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[var(--radius-button)] border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                autoComplete="email"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Phone <span className="text-muted">(optional)</span>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-[var(--radius-button)] border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                autoComplete="tel"
              />
            </label>
          </section>

          {error && (
            <p className="rounded-[var(--radius-button)] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <ArrowButton type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? "Issuing ticket…" : "Claim complimentary ticket"}
          </ArrowButton>

          <p className="text-center text-xs text-muted">
            This link is private. Do not share it publicly.
          </p>
        </form>
      </div>

      <p className="text-center text-sm text-muted">
        <Link
          href={
            context === "dashboard"
              ? `/dashboard/events/${event.slug}`
              : `/e/${event.slug}`
          }
          className="font-medium text-primary hover:underline"
        >
          {context === "dashboard" ? "Back to event" : "View public event page"}
        </Link>
      </p>
    </div>
  );
}
