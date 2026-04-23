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
import { marketingImages } from "@/lib/marketing-images";
import { HomeParallaxBand } from "@/components/home/HomeParallaxBand";

type QuickLink = { label: string; href: string };

const ease = [0.22, 1, 0.36, 1] as const;

export function HomeQuickBrowseChips({
  quickFilterLinks,
  genreLinks,
  eyebrow = "Browse faster",
  sectionClassName,
  variant = "default",
}: {
  quickFilterLinks: QuickLink[];
  genreLinks: QuickLink[];
  /** Section label above the chip rows (home default: “Browse faster”). */
  eyebrow?: string;
  /** Extra classes on the outer `<motion.section>` (e.g. `mb-0` when nested in a catalogue shell). */
  sectionClassName?: string;
  /** Softer chips for dark catalogue panels. */
  variant?: "default" | "catalogue";
}) {
  const reduce = useReducedMotion();
  const catalogue = variant === "catalogue";
  const chipReveal = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.05 * i, duration: 0.45, ease },
    }),
  };

  const whenChipClass = catalogue
    ? "inline-flex rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-foreground/95 shadow-none transition-colors hover:border-primary/45 hover:bg-primary/[0.08]"
    : "inline-flex rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5";
  const vibesChipClass = catalogue
    ? "inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-primary/40 hover:text-primary"
    : "inline-flex rounded-full border border-border/80 bg-wash px-4 py-2 text-sm font-medium text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary";

  return (
    <motion.section
      className={["mb-10 md:mb-14", sectionClassName].filter(Boolean).join(" ")}
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
        className={[
          "mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary",
          catalogue ? "mb-3" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {eyebrow}
      </motion.p>
      <div className={["flex flex-wrap items-center gap-2", catalogue ? "mb-5 gap-2" : "mb-6"].join(" ")}>
        <span className="w-full shrink-0 text-sm text-muted sm:w-auto">When</span>
        {quickFilterLinks.map((item, i) => (
          <motion.div
            key={item.href}
            custom={i}
            variants={chipReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <Link href={item.href} className={whenChipClass}>
              {item.label}
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-full shrink-0 text-sm text-muted sm:w-auto">Vibes</span>
        {genreLinks.map((item, i) => (
          <motion.div
            key={item.href}
            custom={i + 4}
            variants={chipReveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <Link href={item.href} className={vibesChipClass}>
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
  stackAfterBrowse = false,
}: {
  startingSoonEvents: PublicEvent[];
  /** When true, sits under home “Browse faster” chips—lighter top padding, no layout gap if the calendar is empty. */
  stackAfterBrowse?: boolean;
}) {
  const reduce = useReducedMotion();
  const sectionPad = stackAfterBrowse ? "pt-8 md:pt-10 pb-12 md:pb-16" : "py-12 md:py-16";

  if (startingSoonEvents.length === 0) {
    return (
      <motion.section
        className={sectionPad}
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.55, ease }}
        aria-labelledby="home-calendar-fallback-heading"
      >
        <div className="axs-content-inner">
          <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-border/80 bg-surface/40 p-8 ring-1 ring-white/[0.04] md:flex-row md:items-center md:justify-between md:p-10">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Calendar</p>
              <h2
                id="home-calendar-fallback-heading"
                className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
              >
                Nothing in the next three weeks yet
              </h2>
              <p className="text-muted text-base leading-relaxed">
                The full catalogue still updates daily—filter by date, format, or vibe and we will surface new drops
                here when they land.
              </p>
            </div>
            <SwapCtaLink
              href="/events"
              line1="Browse all events"
              line2="Open catalogue →"
              look="text"
              className="text-foreground/80 hover:text-primary md:shrink-0"
            />
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      className={sectionPad}
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease }}
    >
      <div className="axs-content-inner mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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
      text: "Checkout was calm—fees were obvious before I paid. The QR worked first try at registration, even on patchy venue Wi‑Fi.",
      who: "Amara K.",
      role: "Delegate · Nairobi",
      img: marketingImages.quoteA,
    },
    {
      text: "We published tiers in an afternoon. Sponsors saw the same currency and copy we approved—no spreadsheet drift.",
      who: "Jordan M.",
      role: "Events lead · Accra",
      img: marketingImages.quoteB,
    },
    {
      text: "Passes in my inbox and in my account meant I wasn’t hunting screenshots when the badge desk opened.",
      who: "Leah T.",
      role: "Attendee · Lagos",
      img: marketingImages.quoteC,
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
    <div className="space-y-10 md:space-y-14">
      <motion.section
        className="relative -mx-[var(--axs-page-gutter)] overflow-hidden bg-background px-[var(--axs-page-gutter)] py-14 text-foreground md:py-20"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.65, ease }}
        aria-labelledby="home-testimonials-heading"
      >
        <div className="axs-hero-brand-glow pointer-events-none absolute inset-0 opacity-[0.55]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/10 via-transparent to-transparent" aria-hidden />

        <div className="relative z-10 axs-content-inner">
          <div className="mb-10 flex items-start gap-3 md:mb-14 md:gap-4">
            <TestimonialsWaveIcon className="mt-0.5 shrink-0 text-foreground/90" />
            <p
              id="home-testimonials-heading"
              className="max-w-lg text-sm leading-relaxed text-muted md:text-[15px]"
            >
              From Nairobi to Cape Town—teams who want flagship forums to feel as polished as the keynote line-up.
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
                  className="flex items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span
                    className={[
                      "block h-0.5 rounded-full transition-[width,background-color] duration-300",
                      i === active ? "w-9 bg-primary md:w-10" : "w-4 bg-white/25 hover:bg-white/40",
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
                  className="font-display text-center text-2xl font-medium leading-snug tracking-tight text-foreground sm:text-3xl md:text-left md:text-[1.75rem] lg:text-4xl xl:text-[2.125rem] xl:leading-[1.2]"
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
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    i === active
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
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
                <p className="font-display text-base font-semibold text-foreground">{quotes[active].who}</p>
                <p className="text-sm text-muted">{quotes[active].role}</p>
              </div>
            </div>

            <div className="flex gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-white/5 text-foreground transition hover:border-white/30 hover:bg-white/10"
                aria-label="Previous testimonial"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="inline-flex size-11 items-center justify-center rounded-sm border border-white/20 bg-white/5 text-foreground transition hover:border-white/30 hover:bg-white/10"
                aria-label="Next testimonial"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div
        className="py-14 md:py-20"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        <HomeParallaxBand
          imageSrc="/images/hero_image.jpg"
          alt="Speaker presenting in a bright conference room"
          imageClassName="scale-105 sm:scale-100"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
            className="max-w-xl space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Event venues</p>
            <p className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight text-foreground [text-shadow:0_2px_24px_rgba(255,255,255,0.85)]">
              Listings and checkout that match the rigour of your keynote stage.
            </p>
            <p className="text-foreground/75 text-base md:text-lg leading-relaxed [text-shadow:0_1px_16px_rgba(255,255,255,0.75)]">
              Built for multi-day summits: clear agendas, transparent fees, and passes delegates can open even when
              the venue Wi‑Fi is under load.
            </p>
          </motion.div>
        </HomeParallaxBand>
      </motion.div>

      <motion.section
        className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-panel)] ring-1 ring-white/[0.05]"
        initial={reduce ? false : { opacity: 0, scale: 0.99 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease }}
      >
        <Image
          src={marketingImages.buyerBand}
          alt="Team collaborating in a bright professional workspace"
          fill
          className="object-cover"
          sizes="100vw"
          unoptimized={shouldUnoptimizeEventImage(marketingImages.buyerBand)}
        />
        <div className="absolute inset-0 bg-linear-to-r from-foreground/88 via-foreground/72 to-foreground/45" />
        <div className="relative z-10 axs-content-inner flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 p-10 md:p-14 text-background">
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
      className="relative -mx-[var(--axs-page-gutter)] px-[var(--axs-page-gutter)] pb-10 pt-14 md:pb-14 md:pt-20"
    >
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.65, ease }}
        className="axs-content-inner grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
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
          <div className="flex flex-col flex-wrap gap-3 pt-2 sm:flex-row sm:items-stretch">
            <ArrowCtaLink
              href="/register"
              variant="primary"
              className="justify-center !border-transparent !bg-primary-dark !text-white shadow-[0_4px_16px_-6px_rgba(192,41,66,0.38)] hover:!bg-primary-dark/90 hover:!shadow-[0_6px_20px_-6px_rgba(192,41,66,0.35)] sm:min-w-0 sm:flex-1"
            >
              Create organizer account
            </ArrowCtaLink>
            <ArrowCtaLink
              href="/organizers"
              variant="outline"
              className="justify-center !border-white/35 !bg-white/[0.1] !text-white shadow-none hover:!border-primary/55 hover:!bg-primary/20 hover:!text-white sm:min-w-0 sm:flex-1"
            >
              Full organizer guide
            </ArrowCtaLink>
            <ArrowCtaLink
              href="/events"
              variant="outline"
              className="justify-center !border-white/35 !bg-transparent !text-white shadow-none hover:!border-white/55 hover:!bg-white/[0.08] sm:min-w-0 sm:flex-1"
            >
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
            src={marketingImages.organizerSide}
            alt="Bright open-plan office with workstations and natural light"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerSide)}
          />
        </motion.div>
      </motion.section>
    </div>
  );
}
