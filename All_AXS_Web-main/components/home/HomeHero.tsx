"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { SwapCtaLink } from "@/components/ui/SwapCtaLink";

const HERO_IMAGE = "/images/hero_image.jpg";

const EYEBROW = "Pan-African ticketing";
const TITLE_LEAD = "Live culture,";
const TITLE_HIGHLIGHT = "flawless checkout.";
const SUBCOPY =
  "Discover events across Africa, pay with confidence, and walk in with a QR that just works—built for fans first, and for organizers who care about the door.";

export default function HomeHero() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.12,
        delayChildren: reduce ? 0 : 0.1,
      },
    },
  };

  const item: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 32,
      filter: reduce ? "blur(0px)" : "blur(10px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: reduce ? 0 : 0.62,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const headlineContainer: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.48,
        delayChildren: reduce ? 0 : 0,
      },
    },
  };

  const headlineLead: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 56,
      scale: reduce ? 1 : 0.92,
      filter: reduce ? "blur(0px)" : "blur(14px)",
      clipPath: reduce ? "none" : "inset(0 0 100% 0)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      clipPath: "inset(0 0 0 0)",
      transition: {
        duration: reduce ? 0 : 1.35,
        ease: [0.2, 0.78, 0.18, 1] as const,
      },
    },
  };

  const headlineAccent: Variants = {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : 64,
      scale: reduce ? 1 : 0.86,
      filter: reduce ? "blur(0px)" : "blur(20px)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: reduce
        ? { duration: 0 }
        : {
            duration: 2.05,
            ease: [0.14, 0.68, 0.1, 1] as const,
          },
    },
  };

  const initialState = reduce ? "show" : "hidden";
  const floatIdle = !reduce;

  return (
    <section
      className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 -mt-[calc(2rem+4.25rem)] mb-24 min-h-dvh overflow-hidden md:-mt-[calc(2.5rem+4.25rem)] md:mb-28"
      aria-label="Hero"
    >
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-linear-to-r from-white via-white/96 to-white/45 sm:via-white/92 sm:to-white/28"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-linear-to-t from-white/95 via-transparent to-white/30"
          aria-hidden
        />
      </div>

      <div className="axs-page-shell relative z-10 flex min-h-dvh items-center pt-[calc(4.25rem+2rem)] pb-20 md:pb-24 lg:pb-28">
        <motion.div
          className="max-w-2xl lg:max-w-3xl"
          animate={floatIdle ? { y: [0, -7, 0] } : { y: 0 }}
          transition={
            floatIdle
              ? { duration: 5.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        >
          <motion.div variants={container} initial={initialState} animate="show">
            <motion.p
              variants={item}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-primary [text-shadow:0_1px_14px_rgba(255,255,255,0.95)]"
            >
              {EYEBROW}
            </motion.p>

            <motion.h1
              variants={headlineContainer}
              className="font-display mt-5 text-balance text-4xl leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.05rem] xl:text-[3.45rem]"
            >
              <motion.span
                variants={headlineLead}
                className="inline-block text-foreground [text-shadow:0_2px_36px_rgba(255,255,255,0.92),0_1px_2px_rgba(255,255,255,0.98)] will-change-[transform,opacity,filter,clip-path]"
              >
                {TITLE_LEAD}
              </motion.span>{" "}
              <motion.span
                variants={headlineAccent}
                className="inline-block bg-linear-to-r from-primary via-primary-dark to-accent-purple bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] will-change-[transform,opacity,filter]"
              >
                {TITLE_HIGHLIGHT}
              </motion.span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75 [text-shadow:0_1px_18px_rgba(255,255,255,0.9)]"
            >
              {SUBCOPY}
            </motion.p>

            <motion.div variants={item} className="mt-9 flex flex-wrap items-center gap-4">
              <SwapCtaLink
                href="/events"
                line1="Explore events"
                line2="Browse all"
                look="button"
                trailingArrow
                className="border border-transparent bg-primary text-white shadow-[var(--btn-shadow-primary)] hover:bg-primary-dark"
              />
              <SwapCtaLink
                href="/register"
                line1="Sell tickets"
                line2="Get started"
                look="button"
                trailingArrow
                className="border-2 border-primary bg-white/95 text-primary-dark shadow-[var(--btn-shadow-outline)] hover:border-primary-dark/55 hover:bg-primary/5"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
