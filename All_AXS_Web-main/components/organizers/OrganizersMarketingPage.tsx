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
      className={`relative left-1/2 ${SECTION} w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden -mt-[calc(2rem+4.25rem)] md:-mt-[calc(2.5rem+4.25rem)]`}
    >
      <div className="relative min-h-[min(88vh,720px)] w-full">
        <motion.div className="absolute inset-0 h-[115%] w-full -top-[8%]" style={{ y }}>
          <Image
            src={marketingImages.organizerHero}
            alt="Professionals collaborating in a bright modern office before a flagship event"
            fill
            priority
            unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerHero)}
            className="object-cover object-center sm:object-[center_38%]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-zinc-950/40" aria-hidden />
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
          className="relative z-10 flex min-h-[min(88vh,720px)] flex-col justify-end pb-14 pt-24 md:pb-20 md:pt-28"
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
                For organizers
              </motion.p>
              <motion.h1
                variants={fadeUp(reduce, 0.05)}
                className="font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.15rem]"
              >
                Everything you need to publish a flagship event and sell tickets on All AXS
              </motion.h1>
              <motion.p
                variants={fadeUp(reduce, 0.1)}
                className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl"
              >
                One guided flow from first login to live listing: profile, event details, artwork,
                ticket tiers, review, and check-in–ready QR passes for your delegates—built for teams who
                care about registration as much as the keynote story.
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
              </motion.div>
            </motion.div>
            </div>
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
      body: "Upload a banner and assets that match your event—listings stay crisp on every screen size.",
    },
    {
      title: "Review before go-live",
      body: "Submitted events pass a moderation check so buyers only see listings that meet platform standards.",
    },
  ];

  return (
    <section className={SECTION} aria-labelledby="value-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
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
            Built for summits and forums—not generic “events software”
          </motion.h2>
          <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
            From associations to venues and enterprise teams across Africa and beyond, you get a focused
            toolkit for professional events and transparent delegate journeys.
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
    body: "Tell us who’s behind the event—public name, contact, and payout instructions for settlements.",
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
    body: "Submit for review; once approved, your public page and checkout go live. Share the link and scan QR at check-in.",
  },
] as const;

function JourneySection({ reduce }: { reduce: boolean }) {
  return (
    <section id="journey" className={`${SECTION} scroll-mt-28`}>
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
                  src={marketingImages.organizerTeam}
                  alt="Diverse colleagues in a planning session with laptops"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerTeam)}
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
      </div>
    </section>
  );
}

function FeatureMosaic({ reduce }: { reduce: boolean }) {
  const blocks = [
    {
      title: "Checkout buyers trust",
      body: "A focused purchase flow with tier selection and clear totals—fewer surprises at payment.",
      src: marketingImages.organizerTiers,
      alt: "Small team gathered around a laptop reviewing work together",
    },
    {
      title: "Banners that travel",
      body: "Hero imagery scales from phones to desktops; your art stays legible in catalog and on the event page.",
      src: marketingImages.organizerMedia,
      alt: "Engineers or producers collaborating at a long desk with laptops",
    },
    {
      title: "QR-ready passes",
      body: "Delegates get passes they can present at check-in—optimized for quick scanning on opening day.",
      src: marketingImages.organizerGate,
      alt: "Workshop or breakout session with a facilitator and participants",
    },
    {
      title: "Organizer-ready payouts",
      body: "Capture payout instructions in onboarding so finance has what they need for settlements.",
      src: marketingImages.organizerPayouts,
      alt: "Organizer focused on a laptop during a planning session with colleagues nearby",
    },
  ];

  return (
    <section className={SECTION} aria-labelledby="features-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
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
          <motion.p
            variants={fadeUp(reduce, 0.08)}
            className="mt-4 max-w-3xl text-base leading-relaxed text-muted md:text-lg"
          >
            On site, your listing, checkout, and check-in stay aligned—delegates experience what you sold
            online, without a separate “ops” story.
          </motion.p>
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
      </div>
    </section>
  );
}

const CHECKLIST = [
  "A verified email and secure password for your organizer login.",
  "Public-facing organizer name and short description delegates will recognize.",
  "Payout instructions (e.g. bank details) so we can route settlements correctly.",
  "High-resolution banner art (wide hero) plus any extra shots for the listing.",
  "Finalized venue, date, and time—buyers rely on these for travel planning.",
  "Ticket tier names, prices, and quantities aligned with your room capacity.",
  "Refund and entry policies you’re comfortable publishing on the event page.",
] as const;

function ChecklistSection({ reduce }: { reduce: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="checklist-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
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
            <motion.p
              variants={fadeUp(reduce, 0.12)}
              className="mt-5 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-muted"
            >
              <span className="font-semibold text-foreground/90">Review note.</span> Submitted listings are
              checked for completeness and platform fit—placeholders, missing artwork, or unclear tier copy
              are the usual reasons for notes. Solid drafts move fastest.
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
              src={marketingImages.organizerChecklist}
              alt="Professional presenter speaking to colleagues in a bright meeting room"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 38vw, 100vw"
              unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerChecklist)}
            />
          </motion.div>
        </div>
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

const FAQ_SIDE_QUOTE = {
  text: "The clearest listings—complete media, honest tiers, and copy you would publish tomorrow—move fastest through review and convert best on the door.",
  attribution: "All AXS · organizer success",
} as const;

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
            Organizer questions
          </motion.h2>
          <motion.aside
            variants={fadeUp(reduce, 0.1)}
            aria-label="Why details matter"
            className="mt-8 md:mt-10"
          >
            <blockquote className="relative border-l-2 border-primary/40 pl-6 md:pl-8">
              <p className="font-display text-pretty text-2xl font-medium leading-snug tracking-tight text-foreground md:text-[1.65rem] md:leading-[1.2] lg:text-3xl">
                {FAQ_SIDE_QUOTE.text}
              </p>
              <footer className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted md:text-xs">
                {FAQ_SIDE_QUOTE.attribution}
              </footer>
            </blockquote>
          </motion.aside>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="w-full space-y-3"
          aria-label="Frequently asked questions"
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
      <FeatureMosaic reduce={reduce} />
      <ChecklistSection reduce={reduce} />
      <FaqSection reduce={reduce} />
      <FinalCta reduce={reduce} />
    </div>
  );
}
