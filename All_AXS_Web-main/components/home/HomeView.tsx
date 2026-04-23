"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { PublicEvent } from "@/lib/utils/api-server";
import HomeHero from "@/components/home/HomeHero";
import { HomeParallaxBand } from "@/components/home/HomeParallaxBand";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";
import {
  HomeOrganizerChecklistNewsletter,
  HomeQuotesAndBuyerSection,
  HomeStartingSoonAndCity,
} from "@/components/home/HomeExtendedSections";
import { FeaturedEventsHorizontalSection } from "@/components/home/FeaturedEventsHorizontalSection";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";

/** Hotlinked from Unsplash (free use under their license) — African venues, markets & live events. */
const UNSPLASH = {
  /** Wide parallax band — festival crowd & lights */
  crowdLights:
    "https://images.unsplash.com/photo-1709290823099-6ef925ca3ded?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=82",
  /** Second band — stage & colour */
  stage:
    "https://images.unsplash.com/photo-1767656318315-83e47181704e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=82",
  discover:
    "https://images.unsplash.com/photo-1767661667474-4f2a197c9a51?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
  checkout:
    "https://images.unsplash.com/photo-1680878903102-92692799ef36?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
  attend:
    "https://images.unsplash.com/photo-1760092189954-5b2f6eb3ca88?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
  /** Trust strip cards — ixlib for stable CDN behavior */
  trustFees:
    "https://images.unsplash.com/photo-1678693362793-e2fffac536d0?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=82",
  trustQr:
    "https://images.unsplash.com/photo-1708367285460-4789deb6f8a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=82",
  /** Maiye Jeremiah — man on floor with laptop (unsplash.com/photos/WiV1SPZRKoU) */
  trustVetted:
    "https://images.unsplash.com/photo-1728905992073-b7a47319db20?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=82",
  trustPay:
    "https://images.unsplash.com/photo-1569689725958-af8bb9f5486e?ixlib=rb-4.0.3&auto=format&fit=crop&w=900&q=82",
} as const;

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  id,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div id={id} className="max-w-3xl space-y-3 mb-12 scroll-mt-24 md:scroll-mt-28">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        className="font-display text-3xl sm:text-4xl md:text-5xl tracking-tight text-foreground"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        className="text-lg text-muted leading-relaxed"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

export function HomeView({
  featuredEvents,
  startingSoonEvents,
}: {
  featuredEvents: PublicEvent[];
  startingSoonEvents: PublicEvent[];
}) {
  const reduce = useReducedMotion();

  const fadeUp = reduce
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: 28 },
        visible: (i: number) => ({
          opacity: 1,
          y: 0,
          transition: {
            delay: 0.06 * i,
            duration: 0.52,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        }),
      };

  const instant = { hidden: { opacity: 1 }, visible: { opacity: 1 } };

  const sectionReveal: Variants = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <div className="space-y-0">
      <HomeHero />

      {/* 1 — Featured events first */}
      <motion.section
        className="mb-20 md:mb-28"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px", amount: 0.08 }}
        variants={sectionReveal}
      >
        <SectionTitle
          id="events"
          eyebrow="On sale now"
          title="Featured events"
          subtitle="Shows you can book right now—clear dates, venues, and tiers. Tap in, check out, and walk in with a QR that works."
        />
        {featuredEvents.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface/50 p-16 text-center"
          >
            <p className="text-muted text-lg mb-4">No published events yet—check back soon.</p>
            <Link href="/organizer/events/new" className="text-primary font-semibold hover:underline">
              Organizers: list your first show →
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <FeaturedEventsHorizontalSection events={featuredEvents} />
          </motion.div>
        )}
        <motion.div
          className="mt-10 flex justify-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArrowCtaLink href="/events" variant="outline">
            View all events
          </ArrowCtaLink>
        </motion.div>
      </motion.section>

      <HomeStartingSoonAndCity startingSoonEvents={startingSoonEvents} />

      {/* Parallax mood strip */}
      <motion.div
        className="mb-20 md:mb-28"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        <HomeParallaxBand
          imageSrc={UNSPLASH.crowdLights}
          alt="Concert crowd under lights in Johannesburg"
          imageClassName="scale-105 sm:scale-100"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl space-y-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Live rooms</p>
            <p className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight text-foreground [text-shadow:0_2px_24px_rgba(255,255,255,0.85)]">
              Real venues, real energy—ticketing that keeps the focus on the night out.
            </p>
            <p className="text-foreground/75 text-base md:text-lg leading-relaxed [text-shadow:0_1px_16px_rgba(255,255,255,0.75)]">
              From discover to door scan, we care about the moments where trust is earned: lineups you
              can trust, fees you can see, and passes that actually work offline.
            </p>
          </motion.div>
        </HomeParallaxBand>
      </motion.div>

      {/* Trust strip — buyer-first */}
      <motion.section
        className="mb-20 md:mb-28"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionReveal}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {(
            [
              {
                v: "Fees up front",
                l: "Know the total before you pay",
                image: UNSPLASH.trustFees,
                alt: "Hands paying with cash at a market stall",
              },
              {
                v: "QR in your inbox",
                l: "Instant delivery after checkout",
                image: UNSPLASH.trustQr,
                alt: "Woman on a mobile phone call",
              },
              {
                v: "Vetted organizers",
                l: "Listings reviewed before they go live",
                image: UNSPLASH.trustVetted,
                alt: "Man sitting on the floor using a laptop computer",
              },
              {
                v: "Pay your way",
                l: "Built for African payment realities",
                image: UNSPLASH.trustPay,
                alt: "Person holding a smartphone",
              },
            ] as const
          ).map((item, i) => (
            <motion.article
              key={item.v}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-30px", amount: 0.2 }}
              variants={reduce ? instant : fadeUp}
              className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-sm transition-[box-shadow] duration-300 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-foreground/5 sm:aspect-[16/11]">
                {/*
                  Photo stays sharp — teaser is a gradient scrim only. (Image blur + overlay backdrop-blur
                  stacked as “blur on blur”; backdrop-blur also blurred the already-filtered image.)
                */}
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className={[
                    "object-cover will-change-transform",
                    "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "lg:scale-[1.06] motion-reduce:scale-100 lg:group-hover:scale-100",
                  ].join(" ")}
                  unoptimized={shouldUnoptimizeEventImage(item.image)}
                />
                <div
                  className={[
                    "pointer-events-none absolute inset-0",
                    "bg-linear-to-t from-background/88 via-background/45 to-background/10",
                    "transition-[background] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "max-lg:from-background/30 max-lg:via-background/8 max-lg:to-background/0",
                    "motion-reduce:from-background/30 motion-reduce:via-background/12 motion-reduce:to-background/5",
                    "lg:group-hover:from-background/10 lg:group-hover:via-background/5 lg:group-hover:to-background/0",
                  ].join(" ")}
                  aria-hidden
                />
              </div>
              <div className="p-5 md:p-6">
                <p className="font-display text-xl font-semibold text-foreground transition-colors duration-300 lg:group-hover:text-primary">
                  {item.v}
                </p>
                <p className="mt-1 text-sm text-muted leading-relaxed">{item.l}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <HomeQuotesAndBuyerSection />

      {/* How it works + Unsplash tiles */}
      <motion.section
        className="mb-20 md:mb-28"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        variants={sectionReveal}
      >
        <SectionTitle
          eyebrow="The experience"
          title="Built for the full journey—from hype to gate scan"
          subtitle="No fragmented tools or clunky forms. We obsess over discovery, checkout, and entry."
        />
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {(
            [
              {
                step: "01",
                title: "Discover",
                body: "Curated listings, sharp imagery, and dates that scan in a heartbeat—mobile first.",
                image: UNSPLASH.discover,
                alt: "Crowd and DJ at a Lagos nightclub",
              },
              {
                step: "02",
                title: "Checkout",
                body: "Transparent tiers, fees up front, and a calm flow that works on low bandwidth.",
                image: UNSPLASH.checkout,
                alt: "Woman in a green dress holding a phone",
              },
              {
                step: "03",
                title: "Attend",
                body: "QR in your inbox, tickets in your account, and support when plans change.",
                image: UNSPLASH.attend,
                alt: "Crowd with hands raised at a live show",
              },
            ] as const
          ).map((b, i) => (
            <motion.article
              key={b.step}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-20px" }}
              variants={reduce ? instant : fadeUp}
              className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-sm"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-foreground/5">
                <Image
                  src={b.image}
                  alt={b.alt}
                  fill
                  unoptimized={shouldUnoptimizeEventImage(b.image)}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div
                  className="absolute inset-0 bg-linear-to-t from-foreground/35 via-transparent to-transparent opacity-80"
                  aria-hidden
                />
              </div>
              <div className="relative flex flex-1 flex-col p-8 pt-9">
                <span className="absolute top-4 right-4 font-display text-5xl text-primary-dark">
                  {b.step}
                </span>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">{b.title}</h3>
                <p className="text-muted leading-relaxed">{b.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      {/* Second parallax band */}
      <motion.div
        className="mb-20 md:mb-28"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.65 }}
      >
        <HomeParallaxBand
          focal="right"
          imageSrc={UNSPLASH.stage}
          alt="DJ with blue lighting at a Lagos nightclub"
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="ml-auto max-w-xl space-y-4 text-right md:pl-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Design</p>
            <p className="font-display text-2xl sm:text-3xl md:text-4xl leading-tight text-foreground [text-shadow:0_2px_24px_rgba(255,255,255,0.88)]">
              Listings that feel as intentional as the show poster on your wall.
            </p>
          </motion.div>
        </HomeParallaxBand>
      </motion.div>

      <HomeOrganizerChecklistNewsletter />
    </div>
  );
}
