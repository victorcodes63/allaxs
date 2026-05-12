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

function whatsappDigitsOk(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10;
}

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
  /** When signed out: null = not chosen yet; false = account path (must auth); true = guest checkout */
  const [guestMode, setGuestMode] = useState<boolean | null>(null);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setGuestMode(draft.guestMode);
    } else {
      setQty(init);
      setStep("tickets");
      setGuestMode(null);
    }
    setNotifyWhatsapp(false);
  }, [event.id, tiers]);

  useEffect(() => {
    if (!signedIn) return;
    setGuestMode(null);
  }, [signedIn]);

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
    saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (lineItems.length === 0) {
      setError("Choose at least one ticket.");
      setStep("tickets");
      return;
    }
    if (!signedIn && guestMode !== true) {
      setError("Choose guest checkout, or sign in / create an account to continue.");
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
    if (!signedIn && notifyWhatsapp && !whatsappDigitsOk(phone)) {
      setError("Enter a valid mobile number for WhatsApp (at least 10 digits).");
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

    const ticketDelivery =
      signedIn
        ? "account"
        : notifyWhatsapp && phone.trim()
          ? "email_and_whatsapp"
          : "email";
    const guestCheckout = !signedIn;

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
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          orderId?: string;
          reference?: string;
          authorizationUrl?: string;
        };
        if (!res.ok) {
          const msg = Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Checkout failed";
          setError(msg);
          return;
        }
        if (!data.authorizationUrl) {
          setError("Could not start payment.");
          return;
        }
        if (typeof window !== "undefined") {
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
            totalCents: subtotal,
            currency,
            guestCheckout: false,
            ticketDelivery: "account",
          };
          saveOrderForSession(pending);
          clearCheckoutDraft();
          window.location.href = data.authorizationUrl;
        }
        return;
      }

      const orderId = crypto.randomUUID();
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
        totalCents: subtotal,
        currency,
        guestCheckout,
        ticketDelivery,
      };
      saveOrderSnapshot(snapshot);
      clearCheckoutDraft();
      router.push(`/orders/${orderId}/confirmation`);
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
              Demo checkout: no card or wallet is charged. Choose how you want to receive passes—signed-in
              buyers can use <strong>My tickets</strong>; guests get email / WhatsApp details in production
              and instant QR on this device in fallback mode.
            </>
          ) : (
            <>
              {signedIn ? (
                <>
                  Signed in—confirm the attendee name and email on the passes.{" "}
                  {isApiCheckoutEnabled()
                    ? "Your order will sync to your account."
                    : "Demo mode still stores QR passes in this browser."}
                </>
              ) : (
                <>
                  Choose <strong>account checkout</strong> (sign in or register) to save passes to My tickets,
                  or <strong>guest checkout</strong> to continue with email and optional WhatsApp—fallback mode issues
                  QR passes on this device right away.
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

              {!signedIn && guestMode === null && (
                <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-6">
                  <h2 className="font-display text-lg font-semibold text-foreground">How do you want to continue?</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setGuestMode(false);
                        saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: false });
                      }}
                      className="rounded-[var(--radius-card)] border border-border bg-background p-5 text-left transition-colors hover:border-primary/50 hover:bg-wash/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <p className="font-semibold text-foreground">Account checkout</p>
                      <p className="mt-2 text-sm text-muted leading-relaxed">
                        Sign in or create a free account. Passes show up under My tickets and stay with your profile
                        when API checkout is enabled.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setGuestMode(true);
                        saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: true });
                      }}
                      className="rounded-[var(--radius-card)] border border-border bg-background p-5 text-left transition-colors hover:border-primary/50 hover:bg-wash/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <p className="font-semibold text-foreground">Guest checkout</p>
                      <p className="mt-2 text-sm text-muted leading-relaxed">
                        No account. In production we&apos;d email your receipt and links; you can optionally add
                        WhatsApp for the same details.
                      </p>
                    </button>
                  </div>
                </section>
              )}

              {!signedIn && guestMode === false && (
                <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">Sign in or create an account</h2>
                  <div className="space-y-4 rounded-[var(--radius-card)] border border-dashed border-border bg-background/60 p-5">
                    <p className="text-sm text-muted leading-relaxed">
                      Use the same email you&apos;ll use for tickets. After you sign in or register, you&apos;ll land
                      back here with your basket restored.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/login${buildAuthQuery({ next: checkoutReturnPath, intent: "attend" })}`}
                        onClick={() =>
                          saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: false })
                        }
                        className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/5"
                      >
                        Sign in
                      </Link>
                      <Link
                        href={`/register${buildAuthQuery({ next: checkoutReturnPath, intent: "attend" })}`}
                        onClick={() =>
                          saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: false })
                        }
                        className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-colors hover:bg-primary-dark"
                      >
                        Create account
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGuestMode(null);
                        saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: null });
                      }}
                      className="text-sm font-medium text-muted hover:text-primary"
                    >
                      ← Other options
                    </button>
                  </div>
                </section>
              )}

              {(signedIn || guestMode === true) && (
                <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 md:p-8 space-y-4">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    {signedIn ? "Attendee details" : "Guest details"}
                  </h2>
                  {signedIn && (
                    <p className="text-sm text-muted">
                      Completing as <span className="font-medium text-foreground">{email}</span>
                      {isApiCheckoutEnabled() ? " — order will be tied to this account." : null}
                    </p>
                  )}
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
                        readOnly={signedIn}
                        className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 read-only:opacity-80"
                        autoComplete="email"
                      />
                    </label>
                    {!signedIn && (
                      <div className="sm:col-span-2 space-y-3">
                        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-border bg-background/80 p-4">
                          <input
                            type="checkbox"
                            checked={notifyWhatsapp}
                            onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                            className="mt-1 size-4 rounded border-border text-primary focus:ring-primary/30"
                          />
                          <span>
                            <span className="text-sm font-medium text-foreground">
                              Also send ticket details to WhatsApp
                            </span>
                            <span className="mt-1 block text-xs text-muted leading-relaxed">
                              Demo only shows this on the confirmation page; production would message this number.
                            </span>
                          </span>
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                            Mobile for WhatsApp {notifyWhatsapp ? "(required)" : "(optional)"}
                          </span>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+254 …"
                            className="mt-2 w-full rounded-[var(--radius-card)] border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            autoComplete="tel"
                          />
                        </label>
                      </div>
                    )}
                    {signedIn && (
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
                    )}
                  </div>
                  {!signedIn && guestMode === true && (
                    <>
                      {isApiCheckoutEnabled() && (
                        <p className="text-xs text-muted leading-relaxed">
                          Server-backed checkout is available to signed-in buyers only. As a guest, fallback mode still
                          creates your QR passes in this browser right away.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setGuestMode(null);
                          setNotifyWhatsapp(false);
                          saveCheckoutDraft({ eventId: event.id, qty, step: "buyer", guestMode: null });
                        }}
                        className="text-sm font-medium text-muted hover:text-primary"
                      >
                        ← Other options
                      </button>
                    </>
                  )}
                </section>
              )}

              {error && (
                <div className="rounded-[var(--radius-card)] border border-primary/30 bg-wash px-4 py-3 text-sm text-primary-dark">
                  {error}
                </div>
              )}

              <ArrowButton
                type="submit"
                disabled={
                  submitting ||
                  tiers.length === 0 ||
                  (!signedIn && guestMode !== true)
                }
                className="w-full sm:w-auto"
              >
                {submitting
                  ? "Processing…"
                  : isApiCheckoutEnabled() && signedIn
                    ? `Proceed to Pay — ${subtotal / 100} ${currency}`
                    : subtotal === 0
                      ? "Complete checkout — free pass"
                      : `Complete checkout — ${subtotal / 100} ${currency}`}
              </ArrowButton>
              {(signedIn || guestMode === true) && (
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
