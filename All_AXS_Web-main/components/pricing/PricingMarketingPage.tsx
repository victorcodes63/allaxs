"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";
import { marketingImages } from "@/lib/marketing-images";

/** Vertical rhythm between sections — matches the rest of the marketing surface. */
const SECTION = "mb-16 md:mb-24";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = (reduce: boolean, delay = 0) => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease, delay },
  },
});

function PricingParallaxHero() {
  const ref = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const reduce = reduceMotion ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.45], [1, 0.35]);

  return (
    <section
      ref={ref}
      className={`relative left-1/2 ${SECTION} w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden -mt-[calc(2rem+4.25rem)] md:-mt-[calc(2.5rem+4.25rem)]`}
    >
      <div className="relative min-h-[min(78vh,680px)] w-full">
        <motion.div className="absolute inset-0 h-[115%] w-full -top-[8%]" style={{ y }}>
          <Image
            src={marketingImages.organizerPayouts}
            alt="Organizer reviewing settlement reports with a laptop in a bright office"
            fill
            priority
            unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerPayouts)}
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-zinc-950/45" aria-hidden />
          <div className="axs-hero-scrim-animated absolute inset-0 opacity-95" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0.42)_0%,rgba(9,9,11,0.55)_32%,rgba(9,9,11,0.78)_58%,rgba(3,3,4,0.94)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-black/40"
            aria-hidden
          />
        </motion.div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-linear-to-b from-transparent to-background md:h-24"
          aria-hidden
        />
        <motion.div
          className="relative z-10 flex min-h-[min(78vh,680px)] flex-col justify-end pb-14 pt-24 md:pb-20 md:pt-28"
          style={{ opacity }}
        >
          <div className="axs-page-shell w-full">
            <div className="axs-content-inner">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.09 } },
                }}
                className="max-w-3xl space-y-6"
              >
                <motion.p
                  variants={fadeUp(reduce, 0)}
                  className="text-xs font-semibold uppercase tracking-[0.28em] text-primary"
                >
                  Pricing
                </motion.p>
                <motion.h1
                  variants={fadeUp(reduce, 0.05)}
                  className="font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.15rem]"
                >
                  Free to list. Transparent fees on what you sell.
                </motion.h1>
                <motion.p
                  variants={fadeUp(reduce, 0.1)}
                  className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl"
                >
                  No setup fee, no monthly subscription, no surprise charges added to your fans at
                  checkout. Our platform fee is deducted from organizer proceeds — buyers pay the price
                  you publish.
                </motion.p>
                <motion.div
                  variants={fadeUp(reduce, 0.15)}
                  className="flex flex-wrap gap-4 pt-2"
                >
                  <ArrowCtaLink href="/register" variant="primary" className="justify-center">
                    Create organizer account
                  </ArrowCtaLink>
                  <ArrowCtaLink href="/payout-policy" variant="outline" className="justify-center">
                    Read payout policy
                  </ArrowCtaLink>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Listing",
    eyebrow: "Always free",
    price: "Free",
    priceFootnote: "No setup or monthly fees",
    description:
      "Publish your event page, upload artwork, configure ticket tiers, and submit for review at no cost.",
    bullets: [
      "Organizer dashboard and event editor",
      "Ticket tiers, inventory, and capacity controls",
      "Public listing once review is approved",
      "QR-ready passes for door check-in",
    ],
    cta: { href: "/register", label: "Get started", variant: "primary" as const },
    highlight: false,
  },
  {
    name: "Per-ticket platform fee",
    eyebrow: "When tickets sell",
    price: "Disclosed",
    priceFootnote: "at organizer onboarding",
    description:
      "A single platform fee applies to paid tickets, deducted from your proceeds — never added on top for buyers.",
    bullets: [
      "Settlement reports break out every deduction",
      "Buyer total at checkout matches the price you publish",
      "Free events incur no platform fee",
      "Refunded ticket fees follow the refund policy",
    ],
    cta: { href: "/payout-policy", label: "See fee breakdown", variant: "outline" as const },
    highlight: true,
  },
  {
    name: "Payments via Paystack",
    eyebrow: "Card & mobile money",
    price: "Provider rates",
    priceFootnote: "set by Paystack",
    description:
      "Card and mobile money are processed through Paystack. Their transaction fees are deducted alongside the platform fee in your settlement.",
    bullets: [
      "Card payments where supported in your market",
      "Mobile money in supported regions (e.g. Kenya M-Pesa)",
      "Fraud screening & chargeback support included",
      "Currency & cross-border rules per Paystack",
    ],
    cta: { href: "/contact", label: "Talk to sales", variant: "outline" as const },
    highlight: false,
  },
] as const;

function PricingPlans({ reduce }: { reduce: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="plans-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            className="mb-12 max-w-2xl md:mb-16"
          >
            <motion.p
              variants={fadeUp(reduce)}
              id="plans-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
            >
              How pricing works
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              You only pay when fans buy — fans pay what you publish
            </motion.h2>
            <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
              Three building blocks shape every settlement: listing (always free), the platform fee on
              paid tickets, and payment provider charges. Each appears clearly in your organizer
              dashboard so you can reconcile every cent.
            </motion.p>
          </motion.div>
          <ul className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <motion.li
                key={plan.name}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-30px" }}
                variants={fadeUp(reduce, i * 0.06)}
                className={`relative flex flex-col rounded-[var(--radius-panel)] border bg-surface p-7 shadow-sm md:p-8 ${
                  plan.highlight
                    ? "border-primary/40 bg-linear-to-br from-primary/[0.06] via-surface to-background"
                    : "border-border"
                }`}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                    Most relevant
                  </span>
                ) : null}
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  {plan.eyebrow}
                </p>
                <h3 className="font-display mt-3 text-2xl font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-4 font-display text-3xl font-semibold text-foreground md:text-4xl">
                  {plan.price}
                </p>
                <p className="text-sm text-muted">{plan.priceFootnote}</p>
                <p className="mt-5 text-sm leading-relaxed text-muted">{plan.description}</p>
                <ul className="mt-6 space-y-3 text-sm text-foreground/90">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <ArrowCtaLink
                    href={plan.cta.href}
                    variant={plan.cta.variant}
                    className="justify-center"
                  >
                    {plan.cta.label}
                  </ArrowCtaLink>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const SETTLEMENT_STEPS = [
  {
    n: "01",
    title: "Buyers pay the listed price",
    body: "Checkout shows the price you publish per tier. No platform fee is added on top of the buyer's total.",
  },
  {
    n: "02",
    title: "Platform & processor fees deducted",
    body: "The All AXS platform fee and Paystack processing fee are deducted from your gross proceeds before payout.",
  },
  {
    n: "03",
    title: "Refunds & chargebacks reconciled",
    body: "Approved refunds, disputed transactions, and any reserve obligations are netted against the next settlement.",
  },
  {
    n: "04",
    title: "Payout 5–10 business days after event",
    body: "Standard local payouts release 5–10 business days after the event date. International transfers take 7–21 business days.",
  },
] as const;

function SettlementSection({ reduce }: { reduce: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="settlement-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 items-start">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              className="lg:sticky lg:top-28"
            >
              <motion.p
                variants={fadeUp(reduce)}
                id="settlement-heading"
                className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
              >
                Settlement
              </motion.p>
              <motion.h2
                variants={fadeUp(reduce, 0.05)}
                className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
              >
                From paid ticket to payout, with every fee in the open
              </motion.h2>
              <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
                Every settlement report itemises the gross sale, platform fee, payment processor charges,
                refunds, and the net payout. No bundled &ldquo;service charges&rdquo; — what you see is
                what you owe.
              </motion.p>
              <motion.div variants={fadeUp(reduce, 0.14)} className="mt-8 hidden lg:block">
                <div className="relative aspect-[4/5] max-h-[420px] overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-sm">
                  <Image
                    src={marketingImages.organizerTeam}
                    alt="Finance team reviewing event settlement reports"
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerTeam)}
                  />
                </div>
              </motion.div>
            </motion.div>
            <ol className="space-y-0">
              {SETTLEMENT_STEPS.map((step, i) => (
                <motion.li
                  key={step.n}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-20px" }}
                  variants={fadeUp(reduce, i * 0.03)}
                  className="relative border-l border-border pl-8 pb-12 last:pb-0"
                >
                  <span className="absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white tabular-nums">
                    {i + 1}
                  </span>
                  <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary/90">
                    Step {step.n}
                  </p>
                  <h3 className="font-display mt-1 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-muted leading-relaxed">{step.body}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection({ reduce }: { reduce: boolean }) {
  const rows = [
    {
      label: "List an event",
      allaxs: "Free",
      typical: "Often free, but monthly minimums or feature paywalls common",
    },
    {
      label: "Buyer-facing service fee",
      allaxs: "None — buyer pays the listed price",
      typical: "Service fee added on top of ticket price",
    },
    {
      label: "Platform fee",
      allaxs: "Deducted from organizer proceeds, disclosed at onboarding",
      typical: "Mixed: some deducted from organizer, some passed to buyer",
    },
    {
      label: "Payments",
      allaxs: "Paystack (card & mobile money where supported)",
      typical: "Stripe, PayPal, or local provider — provider fees vary",
    },
    {
      label: "Payout cadence",
      allaxs: "5–10 business days after event (local)",
      typical: "Weekly, monthly, or post-event depending on platform",
    },
    {
      label: "Refund handling",
      allaxs: "Reviewed per request; admin-approved; reported in settlements",
      typical: "Self-serve or per-event policy; varies widely",
    },
  ];

  return (
    <section className={SECTION} aria-labelledby="comparison-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-10 max-w-2xl md:mb-14"
          >
            <motion.p
              variants={fadeUp(reduce)}
              id="comparison-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
            >
              What you actually pay
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              All AXS vs. typical ticketing platforms
            </motion.h2>
            <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
              The biggest difference is who pays the platform fee — and how it shows up. With All AXS,
              the buyer total at checkout is exactly the tier price you publish.
            </motion.p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-30px" }}
            variants={fadeUp(reduce)}
            className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-sm"
          >
            <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
              <div className="hidden bg-wash px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted md:block">
                Topic
              </div>
              <div className="hidden bg-wash px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary md:block">
                All AXS
              </div>
              <div className="hidden bg-wash px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted md:block">
                Typical platform
              </div>
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <div className="bg-surface px-6 py-4 text-sm font-semibold text-foreground md:py-5">
                    {row.label}
                  </div>
                  <div className="bg-surface px-6 py-4 text-sm leading-relaxed text-foreground/90 md:py-5">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-primary md:hidden">
                      All AXS
                    </span>
                    <span>{row.allaxs}</span>
                  </div>
                  <div className="bg-surface px-6 py-4 text-sm leading-relaxed text-muted md:py-5">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted md:hidden">
                      Typical platform
                    </span>
                    <span>{row.typical}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Comparisons are illustrative and based on publicly observed market practice. Final fee
            terms for All AXS are confirmed in your organizer onboarding agreement.
          </p>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "Do fans see an extra service fee at checkout?",
    a: "No. The buyer total at checkout matches the tier price you publish. Our platform fee is deducted from organizer proceeds — it is never added on top.",
  },
  {
    q: "What is the exact platform fee percentage?",
    a: "Final fee terms are disclosed in your organizer onboarding agreement and may vary by event type, scale, and market. The fee is itemised in every settlement report.",
  },
  {
    q: "Are there any setup or monthly fees?",
    a: "No. Listing an event, creating tiers, uploading media, and accepting registrations are all free. You only pay when paid tickets sell.",
  },
  {
    q: "How are payment processing fees handled?",
    a: "Paystack handles card and mobile money payments. Their per-transaction fees are deducted alongside the platform fee in your settlement report — you see the breakdown line by line.",
  },
  {
    q: "When do I get paid?",
    a: "Standard local payouts release 5–10 business days after the event date. International transfers take 7–21 business days. Full terms live in the organizer payout policy.",
  },
  {
    q: "What happens to fees when a ticket is refunded?",
    a: "Refunds are handled per the refund & cancellation policy. Approved refunds typically restore the ticket value at 75% (with 25% retained for administrative and processing costs) — exact handling is shown in the settlement report.",
  },
] as const;

function FaqSection({ reduce }: { reduce: boolean }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className={SECTION} aria-labelledby="faq-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-10 max-w-3xl md:mb-14"
          >
            <motion.p
              variants={fadeUp(reduce)}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
            >
              FAQ
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              id="faq-heading"
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              Pricing questions
            </motion.h2>
          </motion.div>

          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="w-full space-y-3"
            aria-label="Pricing FAQs"
          >
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <motion.li
                  key={item.q}
                  variants={fadeUp(reduce)}
                  className="w-full rounded-[var(--radius-card)] border border-border bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display font-semibold text-foreground md:px-6"
                    aria-expanded={isOpen}
                  >
                    {item.q}
                    <span className="text-xl leading-none text-primary" aria-hidden>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 pt-0 leading-relaxed text-muted md:px-6 md:pb-6">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ reduce }: { reduce: boolean }) {
  return (
    <section className="mb-6 md:mb-10">
      <div className="axs-page-shell axs-content-inner">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-linear-to-br from-wash via-surface to-background px-8 py-12 md:px-14 md:py-16"
        >
          <div
            className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <motion.p
                variants={fadeUp(reduce)}
                className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
              >
                Ready to publish?
              </motion.p>
              <motion.h2
                variants={fadeUp(reduce, 0.05)}
                className="font-display text-3xl font-semibold text-foreground md:text-4xl"
              >
                Set up your organizer profile and price your first event
              </motion.h2>
              <motion.p
                variants={fadeUp(reduce, 0.1)}
                className="text-muted text-lg leading-relaxed"
              >
                Listing is free. Fees apply only when paid tickets sell, and they are itemised in every
                settlement — no hidden line items, no surprise buyer charges.
              </motion.p>
            </div>
            <motion.div
              variants={fadeUp(reduce, 0.12)}
              className="flex shrink-0 flex-col gap-3 sm:flex-row"
            >
              <ArrowCtaLink href="/register" variant="primary" className="justify-center">
                Create organizer account
              </ArrowCtaLink>
              <ArrowCtaLink href="/payout-policy" variant="outline" className="justify-center">
                Payout policy
              </ArrowCtaLink>
            </motion.div>
          </div>
          <motion.p
            variants={fadeUp(reduce, 0.14)}
            className="relative z-10 mt-8 text-sm text-muted"
          >
            Already onboarded?{" "}
            <Link
              href="/organizer/dashboard"
              className="font-semibold text-primary hover:underline"
            >
              Open your organizer dashboard
            </Link>{" "}
            (requires sign-in).
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

export function PricingMarketingPage() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div>
      <PricingParallaxHero />
      <PricingPlans reduce={reduce} />
      <SettlementSection reduce={reduce} />
      <ComparisonSection reduce={reduce} />
      <FaqSection reduce={reduce} />
      <FinalCta reduce={reduce} />
    </div>
  );
}
