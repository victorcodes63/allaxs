"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PublicEvent } from "@/lib/types/public-event";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { SwapCtaLink } from "@/components/ui/SwapCtaLink";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";

const US = (id: string) =>
  `https://images.unsplash.com/${id}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1400&q=82`;

const IMG = {
  buyerBand: "/images/hero-3.jpg",
  organizerSide: US("photo-1634954238233-3d1445638a0e"),
  quoteA: US("photo-1608500133806-676bd5e0153f"),
  quoteB: US("photo-1544723795-3fb6469f5b39"),
  quoteC: US("photo-1681284969711-ba6d84f3054c"),
};

type QuickLink = { label: string; href: string };

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeQuickBrowseChips({
  quickFilterLinks,
  genreLinks,
}: {
  quickFilterLinks: QuickLink[];
  genreLinks: QuickLink[];
}) {
  const reduce = useReducedMotion();
  const chipReveal = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.05 * i, duration: 0.45, ease },
    }),
  };

  return (
    <motion.section
      className="mb-10 md:mb-14"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: 0.02 },
        },
      }}
    >
      <motion.p
        variants={{
          hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 12 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
        }}
        className="text-xs font-semibold uppercase tracking-[0.22em] text-primary mb-4"
      >
        Browse faster
      </motion.p>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm text-muted w-full sm:w-auto shrink-0">When</span>
        {quickFilterLinks.map((item, i) => (
          <motion.div
            key={item.href}
            custom={i}
            variants={chipReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <Link
              href={item.href}
              className="inline-flex rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5"
            >
              {item.label}
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted w-full sm:w-auto shrink-0">Vibes</span>
        {genreLinks.map((item, i) => (
          <motion.div
            key={item.href}
            custom={i + 4}
            variants={chipReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <Link
              href={item.href}
              className="inline-flex rounded-full border border-border/80 bg-wash px-4 py-2 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
            >
              {item.label}
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

export function HomeStartingSoonAndCity({
  startingSoonEvents,
}: {
  startingSoonEvents: PublicEvent[];
}) {
  const reduce = useReducedMotion();

  return (
    <>
      {startingSoonEvents.length > 0 ? (
        <motion.section
          className="mb-16 md:mb-24"
          initial={reduce ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Calendar</p>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                Starting soon
              </h2>
              <p className="text-muted text-base md:text-lg leading-relaxed">
                Next three weeks—grab tickets before tiers move.
              </p>
            </div>
            <SwapCtaLink
              href="/events"
              line1="Full catalogue"
              line2="Open →"
              look="text"
              className="text-foreground/75 hover:text-primary sm:pb-1"
            />
          </div>
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-3 -mx-[var(--axs-page-gutter)] px-[var(--axs-page-gutter)] scrollbar-thin">
            {startingSoonEvents.map((event, i) => (
              <motion.div
                key={event.id}
                initial={reduce ? false : { opacity: 0, x: 28 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={{ delay: reduce ? 0 : 0.06 * i, duration: 0.45, ease }}
                className="snap-start shrink-0 w-[min(18rem,calc(100vw-3rem))] sm:w-72"
              >
                <PublicEventCard event={event} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      ) : null}
    </>
  );
}

function TestimonialsWaveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="12" width="4" height="10" rx="1" />
      <rect x="8" y="8" width="4" height="14" rx="1" />
      <rect x="14" y="10" width="4" height="12" rx="1" />
      <rect x="20" y="4" width="4" height="18" rx="1" />
    </svg>
  );
}

export function HomeQuotesAndBuyerSection() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  const quotes = [
    {
      text: "Checkout was calm—fees were obvious before I paid. The QR worked first try at the door, even on patchy venue Wi‑Fi.",
      who: "Amara K.",
      role: "Attendee · Nairobi",
      img: IMG.quoteA,
    },
    {
      text: "We published tiers in an afternoon. Fans actually read the poster on the listing—same currency, same clarity.",
      who: "Jordan M.",
      role: "Organizer · Accra",
      img: IMG.quoteB,
    },
    {
      text: "Tickets in my inbox and in my account meant I wasn’t hunting screenshots at the gate—huge when the line is moving fast.",
      who: "Leah T.",
      role: "Festival-goer · Lagos",
      img: IMG.quoteC,
    },
  ];

  const buyerPoints = [
    "Refunds follow the organizer’s published policy—clearly linked on every listing.",
    "If a show is cancelled, buyers hear from us and the organizer in the same thread.",
    "Support is built for low-connectivity moments: email backup plus in-account tickets.",
  ];

  const n = quotes.length;
  const go = (delta: number) => {
    setActive((i) => (i + delta + n * 10) % n);
  };

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % n);
    }, 3000);
    return () => window.clearInterval(id);
  }, [reduce, n]);

  return (
    <div className="space-y-16 md:space-y-24 mb-16 md:mb-24">
      <motion.section
        className="relative -mx-[var(--axs-page-gutter)] bg-white px-[var(--axs-page-gutter)] py-14 text-zinc-950 md:py-20"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.65, ease }}
        aria-labelledby="home-testimonials-heading"
      >
        <div className="mb-10 flex items-start gap-3 md:mb-14 md:gap-4">
          <TestimonialsWaveIcon className="mt-0.5 shrink-0 text-zinc-900" />
          <p
            id="home-testimonials-heading"
            className="max-w-lg text-sm leading-relaxed text-zinc-700 md:text-[15px]"
          >
            From Nairobi to Cape Town—real fans and organizers who want live culture to feel effortless.
          </p>
        </div>

        <div className="mb-12 flex flex-col gap-10 md:mb-16 lg:flex-row lg:items-stretch lg:gap-12 xl:gap-16">
          <div
            className="flex flex-row gap-2 lg:flex-col lg:gap-2.5 lg:pt-1"
            role="tablist"
            aria-label="Choose testimonial"
          >
            {quotes.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls={`testimonial-panel-${i}`}
                id={`testimonial-tab-${i}`}
                onClick={() => setActive(i)}
                className="flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <span
                  className={[
                    "block h-0.5 rounded-full transition-[width,background-color] duration-300",
                    i === active ? "w-9 bg-primary md:w-10" : "w-4 bg-zinc-300 hover:bg-zinc-400",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="sr-only">Testimonial {i + 1}</span>
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.blockquote
                key={active}
                id={`testimonial-panel-${active}`}
                role="tabpanel"
                aria-labelledby={`testimonial-tab-${active}`}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: reduce ? 0 : 0.28, ease }}
                className="font-display text-center text-2xl font-medium leading-snug tracking-tight text-zinc-950 sm:text-3xl md:text-left md:text-[1.75rem] lg:text-4xl xl:text-[2.125rem] xl:leading-[1.2]"
              >
                &ldquo;{quotes[active].text}&rdquo;
              </motion.blockquote>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 md:gap-5">
            {quotes.map((q, i) => (
              <button
                key={q.who}
                type="button"
                onClick={() => setActive(i)}
                className={[
                  "relative size-12 shrink-0 overflow-hidden rounded-sm outline-none transition",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  i === active
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-white"
                    : "opacity-75 hover:opacity-100",
                ].join(" ")}
                aria-label={`Show quote from ${q.who}`}
                aria-pressed={i === active}
              >
                <Image
                  src={q.img}
                  alt=""
                  fill
                  className={i === active ? "object-cover" : "object-cover grayscale"}
                  sizes="48px"
                  unoptimized={shouldUnoptimizeEventImage(q.img)}
                />
              </button>
            ))}
            <div className="min-h-12 border-l-2 border-primary pl-3 sm:ml-1" aria-live="polite">
              <p className="font-display text-base font-semibold text-zinc-950">{quotes[active].who}</p>
              <p className="text-sm text-zinc-600">{quotes[active].role}</p>
            </div>
          </div>

          <div className="flex gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => go(-1)}
              className="inline-flex size-11 items-center justify-center rounded-sm border border-zinc-300 bg-white text-zinc-900 transition hover:bg-zinc-50"
              aria-label="Previous testimonial"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex size-11 items-center justify-center rounded-sm border border-zinc-300 bg-white text-zinc-900 transition hover:bg-zinc-50"
              aria-label="Next testimonial"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="relative overflow-hidden rounded-[var(--radius-panel)] min-h-[320px]"
        initial={reduce ? false : { opacity: 0, scale: 0.99 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease }}
      >
        <Image
          src={IMG.buyerBand}
          alt="Live event atmosphere"
          fill
          className="object-cover"
          sizes="100vw"
          unoptimized={shouldUnoptimizeEventImage(IMG.buyerBand)}
        />
        <div className="absolute inset-0 bg-linear-to-r from-foreground/88 via-foreground/72 to-foreground/45" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 p-10 md:p-14 text-background">
          <div className="max-w-xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-background/90">Buyer protection</p>
            <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight">Policies you can point to—before and after purchase</h3>
            <ul className="space-y-2.5 text-background/90 text-sm md:text-base leading-relaxed">
              {buyerPoints.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex w-full max-w-md shrink-0 flex-col gap-2.5 sm:max-w-sm lg:ml-auto lg:items-stretch">
            <ArrowCtaLink
              href="/events"
              variant="outline"
              fullWidth
              className="border-white/35 bg-background text-foreground shadow-[var(--btn-shadow-outline)] hover:border-white/50 hover:bg-background/92 hover:text-foreground"
            >
              Browse events
            </ArrowCtaLink>
            <Link
              href="/terms"
              className="inline-flex min-h-[var(--btn-min-h)] w-full items-center justify-center rounded-[var(--radius-button)] border border-white/30 bg-white/5 px-[var(--btn-pad-x)] py-[var(--btn-pad-y)] text-center text-sm font-semibold text-background transition hover:border-white/45 hover:bg-white/12"
            >
              Terms, fees & policies
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

const ORGANIZER_STEPS = [
  {
    n: "01",
    title: "Create your organizer profile",
    body: "Verify contact details and payout preferences once—listings inherit them.",
  },
  {
    n: "02",
    title: "Design your tiers",
    body: "General, early bird, VIP—quantities and fees stay visible on the listing.",
  },
  {
    n: "03",
    title: "Publish & share",
    body: "Go live with a public URL, poster art, and dates that look sharp on mobile.",
  },
  {
    n: "04",
    title: "Scan at the door",
    body: "Export-ready scans and buyer QR codes without a separate tool.",
  },
] as const;

export function HomeOrganizerChecklistNewsletter() {
  const reduce = useReducedMotion();

  return (
    <div
      id="sell"
      className="relative -mx-[var(--axs-page-gutter)] mb-8 px-[var(--axs-page-gutter)] md:mb-12"
    >
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.65, ease }}
        className="border-t border-border/70 pt-12 md:pt-16 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center"
      >
        <div className="space-y-6 order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">For organizers</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Run payouts, tiers, and gate-ready tickets in one place.
          </h2>
          <p className="text-muted text-lg leading-relaxed">
            List a show in minutes—not scattered spreadsheets. Onboard once, publish with confidence, and
            give your buyers a checkout that feels as premium as your brand.
          </p>
          <ol className="space-y-5">
            {ORGANIZER_STEPS.map((step, i) => (
              <motion.li
                key={step.n}
                initial={reduce ? false : { opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: reduce ? 0 : 0.06 * i, duration: 0.45, ease }}
                className="flex gap-4"
              >
                <span className="font-display text-2xl text-primary/35 tabular-nums">{step.n}</span>
                <div>
                  <p className="font-display font-semibold text-foreground">{step.title}</p>
                  <p className="text-muted text-sm mt-1 leading-relaxed">{step.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
          <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-3 pt-2">
            <ArrowCtaLink
              href="/register"
              variant="primary"
              className="justify-center !border-transparent !bg-primary-dark !shadow-[0_4px_16px_-6px_rgba(192,41,66,0.38)] hover:!bg-primary-dark/92 hover:!shadow-[0_6px_20px_-6px_rgba(192,41,66,0.35)]"
            >
              Create organizer account
            </ArrowCtaLink>
            <ArrowCtaLink href="/organizers" variant="outline" className="justify-center border-border bg-white">
              Full organizer guide
            </ArrowCtaLink>
            <ArrowCtaLink href="/events" variant="outline" className="justify-center">
              See a sample listing
            </ArrowCtaLink>
          </div>
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease }}
          className="relative order-1 lg:order-2 aspect-[4/3] overflow-hidden rounded-2xl"
        >
          <Image
            src={IMG.organizerSide}
            alt="Crowd gathered outside a Lagos venue"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            unoptimized={shouldUnoptimizeEventImage(IMG.organizerSide)}
          />
        </motion.div>
      </motion.section>
    </div>
  );
}
