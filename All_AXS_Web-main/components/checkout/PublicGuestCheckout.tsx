"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PublicEvent } from "@/lib/utils/api-server";
import { getEventBannerUrl, generatePlaceholderImage } from "@/lib/utils/image";
import { resolveCurrencyFromTiers } from "@/lib/currency";
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  resolveCheckoutQuantities,
  saveCheckoutDraft,
  saveOrderForSession,
  saveOrderSnapshot,
  type CheckoutLineItem,
  type StoredOrder,
} from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import { isUuid } from "@/lib/public-events-mode";
import {
  previewCheckoutCoupon,
  type CouponPreviewResponse,
} from "@/lib/checkout-coupons";
import { isValidEmailFormat } from "@/lib/validation/checkout";
import {
  canOfferInstallments,
  firstInstallmentCents,
  installmentTierForCart,
} from "@/lib/checkout-installments";
import { isCheckoutEmailNotVerifiedError } from "@/lib/auth/email-verification-gate";
import { EmailVerificationCheckoutGate } from "@/components/checkout/EmailVerificationCheckoutGate";
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

export function PublicGuestCheckout({
  event,
  waitlistToken,
}: {
  event: PublicEvent;
  waitlistToken?: string | null;
}) {
  const router = useRouter();
  const eventDetailPath = `/e/${event.slug}`;

  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] =
    useState<CouponPreviewResponse | null>(null);
  const [payInInstallments, setPayInInstallments] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [waitlistOffer, setWaitlistOffer] = useState<{
    tierId: string;
    tierName?: string;
    email?: string;
    expiresAt?: string;
  } | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  useEffect(() => {
    const token = waitlistToken?.trim();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/events/waitlist/verify?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          valid?: boolean;
          reason?: string;
          tierId?: string;
          tierName?: string;
          email?: string;
          expiresAt?: string;
        };
        if (cancelled) return;
        if (!data.valid || !data.tierId) {
          setWaitlistError(data.reason || "This waitlist link is invalid or expired.");
          return;
        }
        setWaitlistOffer({
          tierId: data.tierId,
          tierName: data.tierName,
          email: data.email,
          expiresAt: data.expiresAt,
        });
      } catch {
        if (!cancelled) {
          setWaitlistError("Could not verify your waitlist link.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [waitlistToken]);

  const tiers = useMemo(() => {
    const available = event.ticketTypes?.filter(tierAvailable) ?? [];
    if (!waitlistOffer) return available;
    const waitlistTier = event.ticketTypes?.find((t) => t.id === waitlistOffer.tierId);
    if (waitlistTier && !available.some((t) => t.id === waitlistTier.id)) {
      return [waitlistTier, ...available];
    }
    return available;
  }, [event.ticketTypes, waitlistOffer]);

  useEffect(() => {
    const draft = loadCheckoutDraft(event.id);
    setQty(resolveCheckoutQuantities(tiers, draft?.qty));
    setDraftReady(true);
  }, [event.id, tiers]);

  useEffect(() => {
    if (!waitlistOffer || !draftReady) return;
    const tier = event.ticketTypes?.find((t) => t.id === waitlistOffer.tierId);
    if (!tier) return;
    const minQ = tier.minPerOrder ?? 1;
    setQty((prev) => ({ ...prev, [waitlistOffer.tierId]: minQ }));
    if (waitlistOffer.email) {
      setEmail((prev) => (prev.trim() ? prev : waitlistOffer.email ?? ""));
    }
  }, [waitlistOffer, draftReady, event.ticketTypes]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          user?: { email?: string; name?: string; emailVerified?: boolean };
        };
        const u = data.user;
        if (u?.email) {
          setSignedIn(true);
          setEmailVerified(u.emailVerified);
          setEmail((prev) => (prev.trim() ? prev : u.email ?? ""));
          setName((prev) => (prev.trim() ? prev : u.name ?? ""));
        }
      } catch {
        /* guest flow */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lineItems: CheckoutLineItem[] = useMemo(
    () =>
      tiers
        .filter((t) => (qty[t.id] ?? 0) > 0)
        .map((t) => ({
          ticketTypeId: t.id,
          name: t.name,
          quantity: qty[t.id] ?? 0,
          unitPriceCents: t.priceCents,
          currency: t.currency,
        })),
    [tiers, qty],
  );

  const subtotal = lineItems.reduce(
    (s, li) => s + li.unitPriceCents * li.quantity,
    0,
  );
  const currency = resolveCurrencyFromTiers(tiers);

  const lineSignature = useMemo(
    () =>
      lineItems
        .map((li) => `${li.ticketTypeId}:${li.quantity}`)
        .sort()
        .join("|"),
    [lineItems],
  );
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [lineSignature]);

  const installmentsAvailable = canOfferInstallments(lineItems, tiers);

  useEffect(() => {
    if (!installmentsAvailable) setPayInInstallments(false);
  }, [installmentsAvailable]);

  const discountCents =
    appliedCoupon?.valid && appliedCoupon.discountCents > 0
      ? Math.min(appliedCoupon.discountCents, subtotal)
      : 0;
  const netTotalCents = Math.max(0, subtotal - discountCents);
  const installmentTier = installmentTierForCart(lineItems, tiers);
  const dueToday =
    payInInstallments && installmentTier?.installmentConfig
      ? firstInstallmentCents(netTotalCents, installmentTier.installmentConfig)
      : netTotalCents;

  const emailValid = email.trim() === "" || isValidEmailFormat(email);
  const emailShowError = emailTouched && email.trim() !== "" && !emailValid;

  const persistDraft = () => {
    saveCheckoutDraft({ eventId: event.id, qty, step: "buyer" });
  };

  const validateCart = (): boolean => {
    if (lineItems.length === 0) {
      setError("Choose at least one ticket.");
      return false;
    }
    for (const t of tiers) {
      const q = qty[t.id] ?? 0;
      if (q === 0) continue;
      const min = t.minPerOrder ?? 1;
      const max = t.maxPerOrder;
      const rem = remaining(t);
      if (q < min) {
        setError(`${t.name}: minimum ${min} per order.`);
        return false;
      }
      if (max && q > max) {
        setError(`${t.name}: maximum ${max} per order.`);
        return false;
      }
      if (q > rem) {
        setError(`${t.name}: only ${rem} seats left.`);
        return false;
      }
    }
    return true;
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a code to apply.");
      return;
    }
    if (lineItems.length === 0) {
      setCouponError("Add tickets before applying a code.");
      return;
    }
    setCouponError(null);
    setCouponApplying(true);
    try {
      const result = await previewCheckoutCoupon({
        eventId: event.id,
        couponCode: code,
        lines: lineItems.map((li) => ({
          ticketTypeId: li.ticketTypeId,
          quantity: li.quantity,
        })),
        buyerEmail: email.trim() || undefined,
      });
      if (!result.valid) {
        setAppliedCoupon(null);
        setCouponError(result.message || "This coupon can't be used on this order.");
        return;
      }
      setAppliedCoupon(result);
      setCouponInput(result.code);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Unable to preview coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
    }
  };

  const buildStoredOrder = (
    orderId: string,
    totalCents: number,
    discount: number,
  ): StoredOrder => ({
    orderId,
    createdAt: new Date().toISOString(),
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    buyerName: name.trim(),
    buyerEmail: email.trim(),
    buyerPhone: phone.trim() || undefined,
    lineItems,
    totalCents,
    currency,
    subtotalCents: subtotal,
    ...(discount > 0 ? { discountCents: discount } : {}),
    ...(appliedCoupon?.valid
      ? { coupon: { code: appliedCoupon.code, discountCents: discount } }
      : {}),
    guestCheckout: !signedIn,
    ticketDelivery: "account",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailTouched(true);
    if (!validateCart()) return;
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email.trim() || !isValidEmailFormat(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (signedIn && emailVerified === false) {
      setError(null);
      return;
    }

    setSubmitting(true);
    try {
      if (isApiCheckoutEnabled()) {
        if (!isUuid(event.id) || lineItems.some((li) => !isUuid(li.ticketTypeId))) {
          setError(
            "This event can't be purchased with live checkout right now. Refresh the event page and try again.",
          );
          return;
        }

        const payload = {
          eventId: event.id,
          lines: lineItems.map((li) => ({
            ticketTypeId: li.ticketTypeId,
            quantity: li.quantity,
          })),
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim() || undefined,
          couponCode: appliedCoupon?.valid ? appliedCoupon.code : undefined,
          ...(payInInstallments && installmentsAvailable
            ? { payInInstallments: true }
            : {}),
          ...(waitlistToken?.trim() ? { waitlistToken: waitlistToken.trim() } : {}),
        };

        const endpoint = signedIn
          ? "/api/checkout/paystack/init"
          : "/api/checkout/guest/paystack/init";

        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          code?: string;
          orderId?: string;
          authorizationUrl?: string | null;
          status?: "PAID" | "AUTH_REQUIRED";
          discountCents?: number;
          amountCents?: number;
          payInInstallments?: boolean;
          planTotalCents?: number;
        };

        if (!res.ok) {
          if (isCheckoutEmailNotVerifiedError(data)) {
            setEmailVerified(false);
            setError(null);
            return;
          }
          const msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Checkout failed";
          setError(msg);
          return;
        }

        const paidDiscount =
          typeof data.discountCents === "number" && data.discountCents > 0
            ? data.discountCents
            : appliedCoupon?.valid
              ? appliedCoupon.discountCents
              : 0;
        const paidTotal =
          typeof data.amountCents === "number"
            ? data.amountCents
            : Math.max(0, subtotal - paidDiscount);

        if (data.status === "PAID" || !data.authorizationUrl) {
          if (data.status !== "PAID") {
            setError("Could not start payment.");
            return;
          }
          const paid = buildStoredOrder(data.orderId || "", paidTotal, paidDiscount);
          saveOrderForSession(paid);
          saveOrderSnapshot(paid);
          clearCheckoutDraft();
          router.push(`/orders/${data.orderId}/confirmation`);
          return;
        }

        const pending = buildStoredOrder(data.orderId || "", paidTotal, paidDiscount);
        saveOrderForSession(pending);
        clearCheckoutDraft();
        window.location.href = data.authorizationUrl;
        return;
      }

      if (!signedIn) {
        setError("Enable API checkout to complete purchases, or sign in for demo mode.");
        return;
      }

      const orderId = crypto.randomUUID();
      const demoDiscount = appliedCoupon?.valid ? appliedCoupon.discountCents : 0;
      const snapshot = buildStoredOrder(
        orderId,
        Math.max(0, subtotal - demoDiscount),
        demoDiscount,
      );
      saveOrderSnapshot(snapshot);
      clearCheckoutDraft();
      router.push(`/orders/${orderId}/confirmation`);
    } finally {
      setSubmitting(false);
    }
  };

  const adjust = (tierId: string, delta: number, max: number, minPer: number, maxPer?: number) => {
    setQty((prev) => {
      const cur = prev[tierId] ?? 0;
      const cap = Math.min(max, maxPer ?? max);
      const next = Math.max(0, Math.min(cap, cur + delta));
      if (delta > 0 && next < minPer && next > 0) return { ...prev, [tierId]: minPer };
      persistDraft();
      return { ...prev, [tierId]: next };
    });
  };

  const bannerUrl = getEventBannerUrl(event.bannerUrl);
  const placeholderUrl = generatePlaceholderImage(event.title);

  if (!draftReady) {
    return (
      <div className="axs-content-inner py-20">
        <p className="text-sm text-muted">Loading checkout…</p>
      </div>
    );
  }

  return (
    <div className="axs-content-inner grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-14 items-start pb-12">
      <div>
        <Link
          href={eventDetailPath}
          className="text-sm font-medium text-muted hover:text-primary transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Event details
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
          Secure checkout
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-tight">
          Complete your purchase
        </h1>
        <p className="text-muted mt-2 max-w-xl">
          No account needed — we&apos;ll email your tickets instantly.{" "}
          {isApiCheckoutEnabled()
            ? "You will be redirected to Paystack to pay securely."
            : "Demo mode requires sign-in."}
        </p>

        {waitlistError && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {waitlistError}
          </p>
        )}
        {waitlistOffer && (
          <p className="mt-4 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm text-foreground">
            Waitlist offer for <strong>{waitlistOffer.tierName ?? "your tier"}</strong>
            {waitlistOffer.expiresAt
              ? ` — complete checkout before ${new Date(waitlistOffer.expiresAt).toLocaleString()}.`
              : " — complete checkout within 30 minutes."}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-10 space-y-8">
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
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjust(tier.id, -1, rem, minP, maxP)}
                          className="h-10 w-10 rounded-[var(--radius-button)] border border-border text-lg font-medium hover:bg-background"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold tabular-nums">{q}</span>
                        <button
                          type="button"
                          onClick={() => adjust(tier.id, 1, rem, minP, maxP)}
                          disabled={q >= Math.min(rem, maxP ?? rem)}
                          className="h-10 w-10 rounded-[var(--radius-button)] border border-border text-lg font-medium hover:bg-background disabled:opacity-40"
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
            <h2 className="font-display text-lg font-semibold text-foreground">Your details</h2>
            {signedIn ? (
              <p className="text-sm text-muted">
                Signed in as <span className="font-medium text-foreground">{email}</span>
              </p>
            ) : null}
            {signedIn && emailVerified === false ? (
              <EmailVerificationCheckoutGate email={email} />
            ) : null}
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Full name <span className="text-primary">*</span>
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
                  Email <span className="text-primary">*</span>
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  readOnly={signedIn}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={`mt-2 w-full rounded-[var(--radius-card)] border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    emailShowError ? "border-primary" : "border-border"
                  } ${signedIn ? "read-only:opacity-80" : ""}`}
                  autoComplete="email"
                  aria-invalid={emailShowError}
                />
                {emailShowError ? (
                  <p className="mt-1 text-xs text-primary-dark" role="alert">
                    Enter a valid email address.
                  </p>
                ) : emailTouched && emailValid && email.trim() ? (
                  <p className="mt-1 text-xs text-emerald-600">Email looks good.</p>
                ) : null}
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Phone (optional)
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="For event updates"
                  className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoComplete="tel"
                />
              </label>
            </div>
          </section>

          {installmentsAvailable && installmentTier?.installmentConfig ? (
            <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payInInstallments}
                  onChange={(e) => setPayInInstallments(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="font-semibold text-foreground block">
                    Pay in installments
                  </span>
                  <span className="text-sm text-muted">
                    Pay{" "}
                    {(firstInstallmentCents(netTotalCents, installmentTier.installmentConfig) /
                      100).toFixed(0)}{" "}
                    {currency} today (
                    {installmentTier.installmentConfig.splits[0]?.pct ?? "—"}% deposit). Remaining
                    payments are due before the event — see confirmation for schedule.
                  </span>
                </span>
              </label>
            </section>
          ) : null}

          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Have a code?</h2>
            {appliedCoupon?.valid ? (
              <div className="rounded-[var(--radius-card)] border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                <span className="font-mono font-medium">{appliedCoupon.code}</span> applied — save{" "}
                {(discountCents / 100).toFixed(0)} {currency}
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }}
                  className="ml-3 text-xs underline text-muted hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Promo code"
                  className="flex-1 rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={() => void applyCoupon()}
                  disabled={couponApplying}
                  className="rounded-[var(--radius-button)] border border-border px-4 py-3 text-sm font-semibold hover:bg-wash disabled:opacity-50"
                >
                  {couponApplying ? "Applying…" : "Apply"}
                </button>
              </div>
            )}
            {couponError ? (
              <p className="text-sm text-primary-dark" role="alert">
                {couponError}
              </p>
            ) : null}
          </section>

          <section className="rounded-[var(--radius-card)] border border-border/80 bg-background/60 px-4 py-3 text-xs text-muted leading-relaxed">
            By completing purchase, an account will be created for ticket management. See our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              privacy policy
            </Link>
            ,{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              terms
            </Link>
            , and{" "}
            <Link href="/refund-policy" className="underline hover:text-foreground">
              refund policy
            </Link>
            .
          </section>

          {error ? (
            <div className="rounded-[var(--radius-card)] border border-primary/30 bg-wash px-4 py-3 text-sm text-primary-dark" role="alert">
              {error}
            </div>
          ) : null}

          <ArrowButton
            type="submit"
            disabled={
              submitting ||
              tiers.length === 0 ||
              (signedIn && emailVerified === false)
            }
            className="w-full sm:w-auto"
          >
            {submitting
              ? "Processing…"
              : dueToday === 0 && appliedCoupon?.valid
                ? "Complete checkout — free with coupon"
                : isApiCheckoutEnabled()
                  ? payInInstallments
                    ? `Pay first installment — ${dueToday / 100} ${currency}`
                    : `Proceed to payment — ${dueToday / 100} ${currency}`
                  : `Complete checkout — ${dueToday / 100} ${currency}`}
          </ArrowButton>

          <p className="text-xs text-muted max-w-lg">
            Payment is processed securely via Paystack. Your tickets and QR codes arrive by email
            immediately after payment.
          </p>
        </form>
      </div>

      <aside className="lg:sticky lg:top-24 rounded-[var(--radius-panel)] border border-border bg-surface overflow-hidden shadow-sm">
        <div className="relative h-40 bg-foreground/5">
          {event.bannerUrl ? (
            <Image src={bannerUrl} alt="" fill className="object-cover" unoptimized={bannerUrl.startsWith("data:")} />
          ) : (
            <Image src={placeholderUrl} alt="" fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="p-6 space-y-4">
          <h3 className="font-display font-semibold text-lg text-foreground line-clamp-2">{event.title}</h3>
          {lineItems.length > 0 && (
            <ul className="text-sm text-muted space-y-2 pb-3 border-b border-border">
              {lineItems.map((li) => (
                <li key={li.ticketTypeId} className="flex justify-between gap-3">
                  <span>
                    {li.name} × {li.quantity}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {(li.unitPriceCents * li.quantity) / 100} {li.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <dl className="text-sm space-y-2 text-muted">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {subtotal / 100} {currency}
              </dd>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Discount</dt>
                <dd className="tabular-nums">−{discountCents / 100} {currency}</dd>
              </div>
            )}
            {payInInstallments && netTotalCents !== dueToday ? (
              <div className="flex justify-between text-muted">
                <dt>Plan total</dt>
                <dd className="tabular-nums">
                  {netTotalCents / 100} {currency}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between pt-2 border-t border-border font-semibold text-foreground">
              <dt>{payInInstallments ? "Due today (1st installment)" : "Due today"}</dt>
              <dd className="tabular-nums">
                {dueToday / 100} {currency}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
