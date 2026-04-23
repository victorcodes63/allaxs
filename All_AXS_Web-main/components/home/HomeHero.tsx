"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Transition, type Variants } from "framer-motion";
import type { PublicEvent } from "@/lib/utils/api-server";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { ArrowCtaLink } from "@/components/ui/ArrowCta";

const HERO_IMAGE = "/images/hero_image.jpg";

const PILL = "Corporate events · discovery to door, composed";
const SUBCOPY =
  "Discovery, purchase, and entry on a single, disciplined surface—forums, summits, and corporate events. Transparent economics, calm checkout, and QR when the room fills.";

/** Hero rail: two cards max. */
const HERO_FEATURED_COUNT = 2;

export default function HomeHero({ featuredEvents }: { featuredEvents: PublicEvent[] }) {
  const reduce = useReducedMotion();

  const spring: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 120, damping: 22, mass: 0.88 };

  const springSoft: Transition = reduce
    ? { duration: 0 }
    : { type: "spring", stiffness: 95, damping: 24, mass: 0.95 };

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.1,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
  };

  const pill: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 14,
      scale: reduce ? 1 : 0.94,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: spring,
    },
  };

  const headlineShell: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.12,
        delayChildren: reduce ? 0 : 0,
      },
    },
  };

  const titleLine: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 36,
      filter: reduce ? "none" : "blur(12px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: spring,
    },
  };

  const titleLineAccent: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 40,
      filter: reduce ? "none" : "blur(14px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { ...spring, stiffness: 108, damping: 20 },
    },
  };

  const subcopy: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 18,
      filter: reduce ? "none" : "blur(6px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { ...springSoft, delay: reduce ? 0 : 0.02 },
    },
  };

  return (
    <section
      className="relative left-1/2 flex min-h-dvh w-screen max-w-[100vw] -translate-x-1/2 flex-col overflow-hidden -mt-[calc(2rem+4.25rem)] md:-mt-[calc(2.5rem+4.25rem)]"
      aria-labelledby="home-hero-heading events"
    >
      {/* Full-bleed image — one continuous stack, no mid-band seam */}
      <div className="absolute inset-0 z-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center sm:object-[center_32%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-zinc-950/40" aria-hidden />
        <div className="axs-hero-scrim-animated absolute inset-0 opacity-95" aria-hidden />
        {/* Smooth vertical grade (no hard step at a fixed % — avoids a visible “horizon line”) */}
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0.42)_0%,rgba(9,9,11,0.55)_32%,rgba(9,9,11,0.78)_58%,rgba(3,3,4,0.94)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-black/40"
          aria-hidden
        />
      </div>

      {/* Only at the physical bottom: soften into page background (next block) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-linear-to-b from-transparent to-background md:h-24"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh flex-1 flex-col axs-page-shell">
        {/* Headline cluster — vertically centered in remaining space above the rail */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-[calc(4.25rem+env(safe-area-inset-top,0px)+1.5rem)] pb-8 text-center sm:pb-10 md:pb-12 md:pt-[calc(4.25rem+env(safe-area-inset-top,0px)+1.75rem)]">
          <motion.div
            className="mx-auto flex max-w-3xl flex-col items-center"
            variants={container}
            initial={reduce ? "show" : "hidden"}
            animate="show"
          >
            <motion.div variants={pill} className="mb-6 md:mb-7">
              <div className="axs-bg-brand-gradient rounded-full p-[1px] shadow-[0_0_28px_-6px_rgba(240,114,65,0.38)]">
                <div className="rounded-full bg-zinc-950/90 px-5 py-2 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/90 sm:text-[11px]">
                    {PILL}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div variants={headlineShell} className="w-full">
              <h1
                id="home-hero-heading"
                className="font-display mx-auto flex max-w-[min(100%,40rem)] flex-col items-center px-2 text-center font-semibold leading-[1.08] tracking-[-0.02em] sm:max-w-[44rem] md:max-w-[48rem]"
              >
                <motion.span
                  variants={titleLine}
                  className="block text-[clamp(1.35rem,3.8vw+0.35rem,2.65rem)] text-white sm:text-4xl md:text-5xl"
                >
                  All Events, One Platform.
                </motion.span>
                <motion.span
                  variants={titleLineAccent}
                  className="axs-text-brand-gradient mt-3 block text-[clamp(2rem,6.5vw+0.2rem,3.85rem)] leading-[1.02] [-webkit-text-fill-color:transparent] sm:mt-4 sm:text-5xl md:mt-5 md:text-6xl"
                >
                  All AXS
                </motion.span>
              </h1>
            </motion.div>

            <motion.p
              variants={subcopy}
              className="mt-5 max-w-lg text-balance text-base leading-relaxed text-white/60 sm:mt-6 sm:text-lg md:mt-7"
            >
              {SUBCOPY}
            </motion.p>
          </motion.div>
        </div>

        {/* Upcoming events — same hero column + image (no separate section chrome) */}
        <motion.div
          className="mt-auto w-full pb-14 pt-2 md:pb-20 md:pt-4"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="axs-content-inner">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-7 md:mb-8">
              <h2
                id="events"
                className="scroll-mt-24 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl md:scroll-mt-28 md:text-4xl"
              >
                Upcoming events
              </h2>
              <Link
                href="/events"
                className="text-sm font-semibold text-primary transition-colors hover:brightness-110"
              >
                See all
              </Link>
            </div>
            {featuredEvents.length === 0 ? (
              <div className="rounded-[var(--radius-card)] bg-zinc-950/55 p-16 text-center ring-1 ring-white/[0.1] backdrop-blur-sm">
                <p className="mb-4 text-lg text-white/65">No published events yet—check back soon.</p>
                <Link href="/organizer/events/new" className="font-semibold text-primary hover:underline">
                  Organizers: publish your first event →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {featuredEvents.slice(0, HERO_FEATURED_COUNT).map((event) => (
                  <PublicEventCard key={event.id} event={event} variant="listRow" />
                ))}
              </div>
            )}
            {featuredEvents.length > 0 && (
              <div className="mt-10 flex justify-center">
                <ArrowCtaLink href="/events" variant="outline">
                  View all listings
                </ArrowCtaLink>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
