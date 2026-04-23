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
import { HomeParallaxBand } from "@/components/home/HomeParallaxBand";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";

const US = (id: string) =>
  `https://images.unsplash.com/${id}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=82`;

/**
 * African live-culture context — matches home marketing picks where possible
 * (Johannesburg crowd, Lagos venue/club, market payments, mobile-first buyers).
 */
const IMG = {
  hero: US("photo-1709290823099-6ef925ca3ded"),
  tiers: US("photo-1678693362793-e2fffac536d0"),
  media: US("photo-1760092189954-5b2f6eb3ca88"),
  gate: US("photo-1708367285460-4789deb6f8a2"),
  payouts: US("photo-1569689725958-af8bb9f5486e"),
  team: US("photo-1634954238233-3d1445638a0e"),
  parallax: US("photo-1767656318315-83e47181704e"),
  checklist: US("photo-1728905992073-b7a47319db20"),
} as const;

/** Vertical rhythm between major page sections */
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

function OrganizersParallaxHero() {
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
      className={`relative left-1/2 ${SECTION} w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden bg-foreground`}
    >
      <div className="relative min-h-[min(88vh,720px)] w-full">
        <motion.div className="absolute inset-0 h-[115%] w-full -top-[8%]" style={{ y }}>
          <Image
            src={IMG.hero}
            alt="Concert crowd under lights in Johannesburg"
            fill
            priority
            unoptimized={shouldUnoptimizeEventImage(IMG.hero)}
            className="object-cover object-center"
            sizes="100vw"
          />
        </motion.div>
        <div
          className="absolute inset-0 bg-linear-to-t from-background via-background/75 to-background/20"
          aria-hidden
        />
        <motion.div
          className="relative z-10 flex min-h-[min(88vh,720px)] flex-col justify-end pb-14 pt-28 md:pb-20 md:pt-32"
          style={{ opacity }}
        >
          <div className="axs-page-shell w-full">
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
                For organizers
              </motion.p>
              <motion.h1
                variants={fadeUp(reduce, 0.05)}
                className="font-display text-4xl leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-[3.15rem]"
              >
                Everything you need to publish a show and sell tickets on All AXS
              </motion.h1>
              <motion.p
                variants={fadeUp(reduce, 0.1)}
                className="text-lg leading-relaxed text-muted md:text-xl max-w-2xl"
              >
                One guided flow from first login to live listing: profile, event details, artwork,
                ticket tiers, review, and gate-ready QR passes for your buyers—built for teams who
                care about the door as much as the poster.
              </motion.p>
              <motion.div
                variants={fadeUp(reduce, 0.15)}
                className="flex flex-wrap gap-4 pt-2"
              >
                <ArrowCtaLink href="/register" variant="primary" className="justify-center">
                  Create organizer account
                </ArrowCtaLink>
                <ArrowCtaLink href="/login" variant="outline" className="justify-center">
                  Sign in
                </ArrowCtaLink>
                <a
                  href="#journey"
                  className="inline-flex items-center justify-center rounded-[var(--radius-button)] px-6 py-3.5 text-sm font-semibold text-foreground/80 underline-offset-4 hover:text-primary hover:underline"
                >
                  How setup works
                </a>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ValueProps({ reduce }: { reduce: boolean }) {
  const items = [
    {
      title: "Guided event editor",
      body: "Details, description, venue, and schedule in one place—structured so nothing critical is missed before you submit.",
    },
    {
      title: "Tiers & inventory",
      body: "Name your tiers, set prices and quantities, and adjust as early demand shapes your room.",
    },
    {
      title: "Media & brand",
      body: "Upload a banner and assets that match your drop—listings stay crisp on every screen size.",
    },
    {
      title: "Review before go-live",
      body: "Submitted events pass a moderation check so buyers only see listings that meet platform standards.",
    },
  ];

  return (
    <section className={SECTION} aria-labelledby="value-heading">
      <div className="axs-page-shell">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07 } },
          }}
          className="max-w-2xl mb-12 md:mb-16"
        >
          <motion.p
            variants={fadeUp(reduce)}
            id="value-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
          >
            Why teams use All AXS
          </motion.p>
          <motion.h2
            variants={fadeUp(reduce, 0.05)}
            className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            Built for real shows—not generic “events software”
          </motion.h2>
          <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
            From independent promoters to venues and festivals, you get a focused toolkit for live
            experiences and transparent buyer journeys.
          </motion.p>
        </motion.div>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.li
              key={item.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-30px" }}
              variants={fadeUp(reduce, i * 0.05)}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm"
            >
              <p className="font-display font-semibold text-foreground">{item.title}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const JOURNEY_STEPS = [
  {
    n: "01",
    title: "Register & verify",
    body: "Create your account and confirm email so we can secure your organizer workspace.",
  },
  {
    n: "02",
    title: "Organizer profile",
    body: "Tell us who’s behind the show—public name, contact, and payout instructions for settlements.",
  },
  {
    n: "03",
    title: "Create the event",
    body: "Title, description, venue, date & time, and visibility. Save drafts until you’re ready.",
  },
  {
    n: "04",
    title: "Media & story",
    body: "Upload a hero banner and supporting imagery so the listing matches your brand.",
  },
  {
    n: "05",
    title: "Ticket tiers",
    body: "Define tiers, prices, and quantities. Buyers see clear labels at checkout.",
  },
  {
    n: "06",
    title: "Submit & go live",
    body: "Submit for review; once approved, your public page and checkout go live. Share the link and scan QR at the door.",
  },
] as const;

function JourneySection({ reduce }: { reduce: boolean }) {
  return (
    <section id="journey" className={`${SECTION} scroll-mt-28`}>
      <div className="axs-page-shell">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16 items-start">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="lg:sticky lg:top-28"
          >
            <motion.p variants={fadeUp(reduce)} className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              The journey
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              From first login to a live listing
            </motion.h2>
            <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
              Follow these steps in the organizer dashboard. You can pause, save, and return—nothing
              goes public until you submit and pass review.
            </motion.p>
            <motion.div variants={fadeUp(reduce, 0.14)} className="mt-8 hidden lg:block">
              <div className="relative aspect-[4/5] max-h-[420px] overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-sm">
                <Image
                  src={IMG.team}
                  alt="Crowd gathered outside a Lagos venue"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  unoptimized={shouldUnoptimizeEventImage(IMG.team)}
                />
              </div>
            </motion.div>
          </motion.div>
          <ol className="space-y-0">
            {JOURNEY_STEPS.map((step, i) => (
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
                <h3 className="font-display mt-1 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-muted leading-relaxed">{step.body}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function FeatureMosaic({ reduce }: { reduce: boolean }) {
  const blocks = [
    {
      title: "Checkout buyers trust",
      body: "A focused purchase flow with tier selection and clear totals—fewer surprises at payment.",
      src: IMG.tiers,
      alt: "Hands paying with cash at a market stall",
    },
    {
      title: "Banners that travel",
      body: "Hero imagery scales from phones to desktops; your art stays legible in catalog and on the event page.",
      src: IMG.media,
      alt: "Fans at an outdoor live show",
    },
    {
      title: "QR-ready passes",
      body: "Buyers get passes they can show at the door—optimized for quick scanning on show night.",
      src: IMG.gate,
      alt: "Woman on a phone call with mobile",
    },
    {
      title: "Organizer-ready payouts",
      body: "Capture payout instructions in onboarding so finance has what they need for settlements.",
      src: IMG.payouts,
      alt: "Person holding a smartphone outdoors",
    },
  ];

  return (
    <section className={SECTION} aria-labelledby="features-heading">
      <div className="axs-page-shell">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="max-w-2xl mb-12"
        >
          <motion.p variants={fadeUp(reduce)} id="features-heading" className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Inside the product
          </motion.p>
          <motion.h2
            variants={fadeUp(reduce, 0.05)}
            className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            What you’re actually configuring
          </motion.h2>
        </motion.div>
        <div className="grid gap-6 md:grid-cols-2">
          {blocks.map((b, i) => (
            <motion.article
              key={b.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-30px" }}
              variants={fadeUp(reduce, i * 0.04)}
              className="group overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-sm"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <Image
                  src={b.src}
                  alt={b.alt}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  sizes="(min-width: 768px) 45vw, 100vw"
                  unoptimized={shouldUnoptimizeEventImage(b.src)}
                />
                <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />
              </div>
              <div className="p-6 md:p-8">
                <h3 className="font-display text-xl font-semibold text-foreground">{b.title}</h3>
                <p className="mt-3 text-muted leading-relaxed">{b.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

const CHECKLIST = [
  "A verified email and secure password for your organizer login.",
  "Public-facing organizer name and short description fans will recognize.",
  "Payout instructions (e.g. bank details) so we can route settlements correctly.",
  "High-resolution banner art (wide hero) plus any extra shots for the listing.",
  "Finalized venue, date, and time—buyers rely on these for travel planning.",
  "Ticket tier names, prices, and quantities aligned with your room capacity.",
  "Refund and door policies you’re comfortable publishing on the event page.",
] as const;

function ChecklistSection({ reduce }: { reduce: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="checklist-heading">
      <div className="axs-page-shell">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 items-center">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            <motion.p variants={fadeUp(reduce)} className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Before you publish
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              id="checklist-heading"
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              Have these ready for a smooth setup
            </motion.h2>
            <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
              You can save drafts while you gather assets. Completing the checklist below speeds up
              review and avoids back-and-forth.
            </motion.p>
            <ul className="mt-8 space-y-4">
              {CHECKLIST.map((line, i) => (
                <motion.li
                  key={line}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={fadeUp(reduce, i * 0.02)}
                  className="flex gap-3 text-foreground/90"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="leading-relaxed">{line}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease }}
            className="relative aspect-[4/5] max-h-[480px] overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-md lg:max-h-none"
          >
            <Image
              src={IMG.checklist}
              alt="Organizer working on a laptop"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 38vw, 100vw"
              unoptimized={shouldUnoptimizeEventImage(IMG.checklist)}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "How long does review take after I submit an event?",
    a: "Timing can vary with volume, but we prioritize clear listings with complete media and tier details. You’ll see status in the organizer dashboard; avoid leaving placeholder copy if you want the fastest pass.",
  },
  {
    q: "Can I edit tickets or pricing after go-live?",
    a: "Use the event editor for allowed changes. Material changes (time, venue, tier structure) may require re-confirmation for buyers—plan major edits before heavy marketing pushes.",
  },
  {
    q: "How do buyers receive tickets?",
    a: "After checkout, buyers access passes from their account and wallet views—designed for QR presentation at entry. Share your public event link so they land on the right listing.",
  },
  {
    q: "What about refunds?",
    a: "Publish a refund policy you can stand behind and link it from the event page. Buyers and support teams rely on that policy when edge cases come up.",
  },
  {
    q: "Do I need a company to sell tickets?",
    a: "You need a complete organizer profile and valid payout details. Solo promoters and registered businesses can both onboard—use the name your audience already trusts.",
  },
] as const;

function FaqSection({ reduce }: { reduce: boolean }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className={SECTION} aria-labelledby="faq-heading">
      <div className="axs-page-shell max-w-3xl">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="mb-10"
        >
          <motion.p variants={fadeUp(reduce)} className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            FAQ
          </motion.p>
          <motion.h2
            variants={fadeUp(reduce, 0.05)}
            id="faq-heading"
            className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          >
            Organizer questions
          </motion.h2>
        </motion.div>
        <ul className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="rounded-[var(--radius-card)] border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display font-semibold text-foreground md:px-6"
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span className="text-primary text-xl leading-none" aria-hidden>
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
                      <p className="px-5 pb-5 pt-0 text-muted leading-relaxed md:px-6 md:pb-6">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FinalCta({ reduce }: { reduce: boolean }) {
  return (
    <section className="mb-6 md:mb-10">
      <div className="axs-page-shell">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-linear-to-br from-wash via-surface to-background px-8 py-12 md:px-14 md:py-16"
        >
          <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-3">
              <motion.p variants={fadeUp(reduce)} className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Ready when you are
              </motion.p>
              <motion.h2
                variants={fadeUp(reduce, 0.05)}
                className="font-display text-3xl font-semibold text-foreground md:text-4xl"
              >
                Start your organizer profile and build your first event
              </motion.h2>
              <motion.p variants={fadeUp(reduce, 0.1)} className="text-muted text-lg leading-relaxed">
                New to All AXS? Register, verify email, then complete onboarding. Returning? Jump
                straight to the dashboard and pick up your draft.
              </motion.p>
            </div>
            <motion.div variants={fadeUp(reduce, 0.12)} className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ArrowCtaLink href="/register" variant="primary" className="justify-center">
                Get started
              </ArrowCtaLink>
              <ArrowCtaLink href="/login" variant="outline" className="justify-center">
                Sign in
              </ArrowCtaLink>
            </motion.div>
          </div>
          <motion.p variants={fadeUp(reduce, 0.14)} className="relative z-10 mt-8 text-sm text-muted">
            Already onboarded?{" "}
            <Link href="/organizer/dashboard" className="font-semibold text-primary hover:underline">
              Open your dashboard
            </Link>{" "}
            (requires sign-in).
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

export function OrganizersMarketingPage() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div>
      <OrganizersParallaxHero />
      <ValueProps reduce={reduce} />
      <JourneySection reduce={reduce} />
      <motion.div
        className={SECTION}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
      >
        <HomeParallaxBand
          focal="left"
          imageSrc={IMG.parallax}
          alt="DJ with lighting at a Lagos nightclub"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease }}
            className="max-w-xl space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">At the venue</p>
            <p className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight text-foreground [text-shadow:0_2px_24px_rgba(255,255,255,0.88)]">
              Your listing, checkout, and door experience stay aligned—so the energy on site matches
              the story you sold online.
            </p>
          </motion.div>
        </HomeParallaxBand>
      </motion.div>
      <FeatureMosaic reduce={reduce} />
      <ChecklistSection reduce={reduce} />
      <motion.section
        className={SECTION}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        <div className="axs-page-shell">
          <motion.div
            variants={fadeUp(reduce)}
            className="rounded-[var(--radius-panel)] border border-border bg-wash/80 px-6 py-8 md:px-10 md:py-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Moderation</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-foreground md:text-3xl">
              Quality bar for public listings
            </h2>
            <p className="mt-4 text-muted leading-relaxed max-w-3xl">
              Submitted events are reviewed for completeness, clarity, and fit with platform
              standards. This protects buyers and keeps the catalogue trustworthy. Incomplete
              placeholders, missing artwork, or unclear tier copy are the usual reasons a submission
              comes back with notes—use the checklist above to sail through.
            </p>
          </motion.div>
        </div>
      </motion.section>
      <FaqSection reduce={reduce} />
      <FinalCta reduce={reduce} />
    </div>
  );
}
