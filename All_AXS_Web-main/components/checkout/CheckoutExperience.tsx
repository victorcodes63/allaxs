"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PublicEvent } from "@/lib/utils/api-server";
import { buildAuthQuery } from "@/lib/auth/post-auth-redirect";
import { getEventBannerUrl, generatePlaceholderImage } from "@/lib/utils/image";
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
  saveOrderForSession,
  saveOrderSnapshot,
  type CheckoutLineItem,
  type StoredOrder,
} from "@/lib/checkout-storage";
import { isApiCheckoutEnabled } from "@/lib/checkout-mode";
import {
  previewCheckoutCoupon,
  type CouponPreviewResponse,
} from "@/lib/checkout-coupons";
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

type CheckoutStep = "tickets" | "buyer";

export function CheckoutExperience({
  event,
  context = "public",
}: {
  event: PublicEvent;
  context?: "public" | "dashboard";
}) {
  const router = useRouter();
  const tiers = useMemo(
    () => event.ticketTypes?.filter(tierAvailable) ?? [],
    [event.ticketTypes]
  );
  const eventDetailPath =
    context === "dashboard" ? `/dashboard/events/${event.slug}` : `/e/${event.slug}`;
  const checkoutReturnPath =
    context === "dashboard"
      ? `/dashboard/events/${event.slug}/checkout`
      : `/events/${event.id}/checkout`;
  const [step, setStep] = useState<CheckoutStep>("tickets");
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
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Coupon state. `applied` is the latest valid preview from the
  // backend; mutating the cart resets it so the buyer always sees the
  // discount the server is currently willing to honour.
  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] =
    useState<CouponPreviewResponse | null>(null);

  useEffect(() => {
    const init: Record<string, number> = {};
    tiers.forEach((t) => {
      init[t.id] = 0;
    });
    const draft = loadCheckoutDraft(event.id);
    if (draft) {
      const merged = { ...init };
      for (const tid of Object.keys(merged)) {
        if (typeof draft.qty[tid] === "number") merged[tid] = draft.qty[tid];
      }
      setQty(merged);
      setStep(draft.step === "buyer" ? "buyer" : "tickets");
    } else {
      setQty(init);
      setStep("tickets");
    }
  }, [event.id, tiers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (cancelled) return;
        if (!res.ok) {
          setSignedIn(false);
          return;
        }
        const data = (await res.json()) as {
          user?: { email?: string; name?: string };
        };
        const u = data.user;
        setSignedIn(!!u?.email);
        if (u) {
          setEmail((prev) => (prev.trim() ? prev : u.email ?? ""));
          setName((prev) => (prev.trim() ? prev : u.name ?? ""));
        }
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Reset the applied coupon whenever the cart changes so the buyer
  // can't carry a stale preview into the pay step. They can re-apply
  // the same code with one click.
  const lineSignature = useMemo(
    () =>
      lineItems
        .map((li) => `${li.ticketTypeId}:${li.quantity}`)
        .sort()
        .join("|"),
    [lineItems]
  );
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [lineSignature]);

  const discountCents =
    appliedCoupon?.valid && appliedCoupon.discountCents > 0
      ? Math.min(appliedCoupon.discountCents, subtotal)
      : 0;
  const dueToday = Math.max(0, subtotal - discountCents);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a code to apply.");
      return;
    }
    if (lineItems.length === 0) {
      setCouponError("Add tickets to your cart before applying a code.");
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
        setCouponError(
          result.message || "This coupon can't be used on this order."
        );
        return;
      }
      setAppliedCoupon(result);
      setCouponInput(result.code);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to preview coupon";
      setCouponError(message);
      setAppliedCoupon(null);
    } finally {
      setCouponApplying(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  };

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

  const goToBuyerStep = () => {
    setError(null);
    if (lineItems.length === 0) {
      setError("Choose at least one ticket.");
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
    setStep("buyer");
    saveCheckoutDraft({ eventId: event.id, qty, step: "buyer" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (lineItems.length === 0) {
      setError("Choose at least one ticket.");
      setStep("tickets");
      return;
    }
    if (!signedIn) {
      setError("Sign in or create an account to continue to payment.");
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

    const ticketDelivery = "account" as const;

    setSubmitting(true);
    try {
      if (isApiCheckoutEnabled() && signedIn) {
        const res = await fetch("/api/checkout/paystack/init", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            lines: lineItems.map((li) => ({
              ticketTypeId: li.ticketTypeId,
              quantity: li.quantity,
            })),
            buyerName: name.trim(),
            buyerEmail: email.trim(),
            buyerPhone: phone.trim() || undefined,
            couponCode: appliedCoupon?.valid ? appliedCoupon.code : undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          orderId?: string;
          reference?: string;
          authorizationUrl?: string | null;
          status?: "PAID" | "AUTH_REQUIRED";
          discountCents?: number;
          amountCents?: number;
        };
        if (!res.ok) {
          const msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Checkout failed";
          setError(msg);
          return;
        }

        // 100%-off coupon: server skipped Paystack and finalized the
        // order. Drop the buyer straight onto the confirmation page.
        if (data.status === "PAID" || !data.authorizationUrl) {
          if (data.status !== "PAID") {
            setError("Could not start payment.");
            return;
          }
          if (typeof window !== "undefined") {
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
            const paid: StoredOrder = {
              orderId: data.orderId || "",
              createdAt: new Date().toISOString(),
              eventId: event.id,
              eventSlug: event.slug,
              eventTitle: event.title,
              buyerName: name.trim(),
              buyerEmail: email.trim(),
              buyerPhone: phone.trim() || undefined,
              lineItems,
              totalCents: paidTotal,
              currency,
              subtotalCents: subtotal,
              ...(paidDiscount > 0 ? { discountCents: paidDiscount } : {}),
              ...(appliedCoupon?.valid
                ? {
                    coupon: {
                      code: appliedCoupon.code,
                      discountCents: paidDiscount,
                    },
                  }
                : {}),
              guestCheckout: false,
              ticketDelivery: "account",
            };
            saveOrderForSession(paid);
            saveOrderSnapshot(paid);
            clearCheckoutDraft();
            router.push(`/orders/${data.orderId}/confirmation`);
          }
          return;
        }

        if (typeof window !== "undefined") {
          const pendingDiscount =
            typeof data.discountCents === "number" && data.discountCents > 0
              ? data.discountCents
              : appliedCoupon?.valid
                ? appliedCoupon.discountCents
                : 0;
          const pendingTotal =
            typeof data.amountCents === "number"
              ? data.amountCents
              : Math.max(0, subtotal - pendingDiscount);
          const pending: StoredOrder = {
            orderId: data.orderId || "",
            createdAt: new Date().toISOString(),
            eventId: event.id,
            eventSlug: event.slug,
            eventTitle: event.title,
            buyerName: name.trim(),
            buyerEmail: email.trim(),
            buyerPhone: phone.trim() || undefined,
            lineItems,
            totalCents: pendingTotal,
            currency,
            subtotalCents: subtotal,
            ...(pendingDiscount > 0 ? { discountCents: pendingDiscount } : {}),
            ...(appliedCoupon?.valid
              ? {
                  coupon: {
                    code: appliedCoupon.code,
                    discountCents: pendingDiscount,
                  },
                }
              : {}),
            guestCheckout: false,
            ticketDelivery: "account",
          };
          saveOrderForSession(pending);
          clearCheckoutDraft();
          window.location.href = data.authorizationUrl;
        }
        return;
      }

      if (!isApiCheckoutEnabled()) {
        const orderId = crypto.randomUUID();
        const demoDiscount = appliedCoupon?.valid
          ? appliedCoupon.discountCents
          : 0;
        const snapshot: StoredOrder = {
          orderId,
          createdAt: new Date().toISOString(),
          eventId: event.id,
          eventSlug: event.slug,
          eventTitle: event.title,
          buyerName: name.trim(),
          buyerEmail: email.trim(),
          buyerPhone: phone.trim() || undefined,
          lineItems,
          totalCents: Math.max(0, subtotal - demoDiscount),
          currency,
          subtotalCents: subtotal,
          ...(demoDiscount > 0 ? { discountCents: demoDiscount } : {}),
          ...(appliedCoupon?.valid
            ? {
                coupon: {
                  code: appliedCoupon.code,
                  discountCents: demoDiscount,
                },
              }
            : {}),
          guestCheckout: false,
          ticketDelivery,
        };
        saveOrderSnapshot(snapshot);
        clearCheckoutDraft();
        router.push(`/orders/${orderId}/confirmation`);
        return;
      }

      setError("Could not start checkout. Check that API checkout is configured.");
    } finally {
      setSubmitting(false);
    }
  };

  const ticketSection = (
    <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Ticket tiers</h2>
        <p className="text-sm text-muted mt-1">Fees are finalized on the last step—same totals you see here.</p>
      </div>
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
                    onClick={() => adjust(tier.id, -1, rem, minP, maxP)}
                    className="h-10 w-10 rounded-[var(--radius-button)] border border-border text-lg font-medium hover:bg-background transition-colors"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold tabular-nums">{q}</span>
                  <button
                    type="button"
                    onClick={() => adjust(tier.id, 1, rem, minP, maxP)}
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
  );

  return (
    <div className="axs-content-inner grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-14 items-start pb-12">
      <div>
        <Link
          href={eventDetailPath}
          className="text-sm font-medium text-muted hover:text-primary transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Event details
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
          {step === "tickets" ? "Step 1 of 2" : "Step 2 of 2"}
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-foreground tracking-tight">
          {step === "tickets" ? "Choose quantities" : "Your details"}
        </h1>
        <p className="text-muted mt-2 max-w-xl">
          {step === "tickets" ? (
            <>
              {isApiCheckoutEnabled()
                ? "You need a signed-in account to pay. Pick your tickets, then sign in or create an account on the next step before Paystack."
                : "Local demo mode: no card is charged. Sign in so passes can be tied to My tickets, or complete in-browser demo passes after you authenticate."}
            </>
          ) : (
            <>
              {signedIn ? (
                <>
                  Confirm the attendee name and email on the passes.{" "}
                  {isApiCheckoutEnabled()
                    ? "Your order will sync to this account and you will be redirected to pay."
                    : "Demo mode stores QR passes in this browser for this account."}
                </>
              ) : (
                <>
                  Sign in or create an account to continue—same flow as major ticketing sites. Your basket is saved in
                  this browser until you return.
                </>
              )}
            </>
          )}
        </p>

        <div className="mt-10 space-y-10">
          {step === "tickets" ? (
            <>
              {ticketSection}
              {error && (
                <div className="rounded-[var(--radius-card)] border border-primary/30 bg-wash px-4 py-3 text-sm text-primary-dark">
                  {error}
                </div>
              )}
              <ArrowButton
                type="button"
                onClick={goToBuyerStep}
                disabled={tiers.length === 0}
                className="w-full sm:w-auto"
              >
                Continue to buyer details
              </ArrowButton>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-10">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("tickets");
                }}
                className="text-sm font-medium text-muted hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                ← Edit tickets
              </button>

              {!signedIn && (
                <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-6">
                  <h2 className="font-display text-lg font-semibold text-foreground">Sign in to continue</h2>
                  <p className="text-sm text-muted leading-relaxed max-w-xl">
                    Checkout is available to signed-in buyers only. Use the same email you want on your tickets—you
                    will return to this page with your quantities saved.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/login${buildAuthQuery({ next: checkoutReturnPath, intent: "attend" })}`}
                      onClick={() => saveCheckoutDraft({ eventId: event.id, qty, step: "buyer" })}
                      className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/5"
                    >
                      Sign in
                    </Link>
                    <Link
                      href={`/register${buildAuthQuery({ next: checkoutReturnPath, intent: "attend" })}`}
                      onClick={() => saveCheckoutDraft({ eventId: event.id, qty, step: "buyer" })}
                      className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-colors hover:bg-primary-dark"
                    >
                      Create account
                    </Link>
                  </div>
                </section>
              )}

              {signedIn && (
                <section
                  aria-labelledby="coupon-section-title"
                  className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4"
                >
                  <div>
                    <h2
                      id="coupon-section-title"
                      className="font-display text-lg font-semibold text-foreground"
                    >
                      Have a code?
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Enter your promo code to apply a discount before payment.
                    </p>
                  </div>

                  {appliedCoupon?.valid ? (
                    <div className="rounded-[var(--radius-card)] border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            <span className="font-mono">{appliedCoupon.code}</span>{" "}
                            applied
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            You save {(discountCents / 100).toFixed(0)}{" "}
                            {appliedCoupon.currency || currency}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="text-xs font-medium text-muted underline hover:text-foreground"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={couponInput}
                        onChange={(e) =>
                          setCouponInput(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. EARLY2026"
                        maxLength={64}
                        spellCheck={false}
                        autoCapitalize="characters"
                        className="flex-1 rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-primary/30"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyCoupon();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void applyCoupon()}
                        disabled={couponApplying || !couponInput.trim()}
                        className="rounded-[var(--radius-button)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-wash disabled:opacity-50"
                      >
                        {couponApplying ? "Applying…" : "Apply"}
                      </button>
                    </div>
                  )}

                  {couponError && (
                    <p
                      role="alert"
                      className="text-sm text-primary-dark"
                    >
                      {couponError}
                    </p>
                  )}
                </section>
              )}

              {signedIn && (
                <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">Attendee details</h2>
                  <p className="text-sm text-muted">
                    Completing as <span className="font-medium text-foreground">{email}</span>
                    {isApiCheckoutEnabled() ? " — order will be tied to this account." : null}
                  </p>
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
                        readOnly
                        className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 read-only:opacity-80"
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
              )}

              {error && (
                <div className="rounded-[var(--radius-card)] border border-primary/30 bg-wash px-4 py-3 text-sm text-primary-dark">
                  {error}
                </div>
              )}

              <ArrowButton
                type="submit"
                disabled={submitting || tiers.length === 0 || !signedIn}
                className="w-full sm:w-auto"
              >
                {submitting
                  ? "Processing…"
                  : dueToday === 0 && appliedCoupon?.valid
                    ? "Complete checkout — free with coupon"
                    : isApiCheckoutEnabled() && signedIn
                      ? `Proceed to Pay — ${dueToday / 100} ${currency}`
                      : dueToday === 0
                        ? "Complete checkout — free pass"
                        : `Complete checkout — ${dueToday / 100} ${currency}`}
              </ArrowButton>
              {signedIn && (
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
              )}
            </form>
          )}
        </div>
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
          {lineItems.length > 0 && (
            <ul className="text-sm text-muted space-y-2 pb-3 border-b border-border">
              {lineItems.map((li) => (
                <li key={li.ticketTypeId} className="flex justify-between gap-3">
                  <span className="line-clamp-2">
                    {li.name} × {li.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-foreground">
                    {(li.unitPriceCents * li.quantity) / 100} {li.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <dl className="text-sm space-y-2 text-muted">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {subtotal / 100} {currency}
              </dd>
            </div>
            {appliedCoupon?.valid && discountCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-foreground">
                  Discount{" "}
                  <span className="font-mono text-xs text-muted">
                    ({appliedCoupon.code})
                  </span>
                </dt>
                <dd className="font-medium text-emerald-500 tabular-nums">
                  −{discountCents / 100} {currency}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt>Fees</dt>
              <dd className="text-muted">Calculated at payment</dd>
            </div>
            <div className="flex justify-between gap-4 pt-2 border-t border-border text-foreground font-semibold">
              <dt>Due today</dt>
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
