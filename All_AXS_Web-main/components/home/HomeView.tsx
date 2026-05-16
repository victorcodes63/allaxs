"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { PublicEvent } from "@/lib/utils/api-server";
import HomeHero from "@/components/home/HomeHero";
import { HomeAboutIntro } from "@/components/home/HomeAboutIntro";
import {
  HomeOrganizerChecklistNewsletter,
  HomeQuickBrowseChips,
  HomeQuotesAndBuyerSection,
  HomeStartingSoonAndCity,
} from "@/components/home/HomeExtendedSections";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";
import { marketingImages } from "@/lib/marketing-images";

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

type HomeQuickLink = { label: string; href: string };

export function HomeView({
  featuredEvents,
  startingSoonEvents,
  quickFilterLinks,
  genreLinks,
}: {
  featuredEvents: PublicEvent[];
  startingSoonEvents: PublicEvent[];
  quickFilterLinks: HomeQuickLink[];
  genreLinks: HomeQuickLink[];
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
    <div className="bg-background">
      {/* 1. Promise + featured events */}
      <HomeHero featuredEvents={featuredEvents} />

      {/* 2. Who we are */}
      <HomeAboutIntro />

      {/* 3. Paths into the catalogue + near-term listings (discovery before long story) */}
      <motion.div
        className="py-12 md:py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionReveal}
      >
        <div className="axs-content-inner">
          <HomeQuickBrowseChips
            quickFilterLinks={quickFilterLinks}
            genreLinks={genreLinks}
            eyebrow="Browse faster"
            sectionClassName="mb-0"
          />
        </div>
        <HomeStartingSoonAndCity
          startingSoonEvents={startingSoonEvents}
          stackAfterBrowse
        />
      </motion.div>

      {/* 4. Buyer trust */}
      <motion.section
        className="py-14 md:py-20"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionReveal}
      >
        <div className="axs-content-inner">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {(
            [
              {
                v: "Fees up front",
                l: "Know the total before you pay",
                image: marketingImages.trustFees,
                alt: "Team reviewing charts on a laptop in an office",
              },
              {
                v: "QR in your inbox",
                l: "Instant delivery after checkout",
                image: marketingImages.trustQr,
                alt: "Laptop on a desk showing product work",
              },
              {
                v: "Vetted organizers",
                l: "Listings reviewed before they go live",
                image: marketingImages.trustVetted,
                alt: "Professional working on a laptop",
              },
              {
                v: "Pay your way",
                l: "Built for African payment realities",
                image: marketingImages.trustPay,
                alt: "Hands typing on a laptop keyboard",
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
              className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface/55 ring-1 ring-white/[0.06] transition-[box-shadow,background-color] duration-300 hover:bg-surface/70 hover:shadow-md"
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
        </div>
      </motion.section>

      {/* 5. Product journey */}
      <motion.section
        className="py-14 md:py-20"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        variants={sectionReveal}
      >
        <div className="axs-content-inner">
        <SectionTitle
          eyebrow="The experience"
          title="From listing to badge scan—one calm thread"
          subtitle="Summits and forums move fast. We keep discovery, purchase, and entry aligned so delegates never lose the plot."
        />
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {(
            [
              {
                step: "01",
                title: "Discover",
                body: "Curated listings, sharp imagery, and dates that scan in a heartbeat—mobile first.",
                image: marketingImages.journeyDiscover,
                alt: "Colleagues collaborating around a laptop in a meeting",
              },
              {
                step: "02",
                title: "Checkout",
                body: "Transparent tiers, fees up front, and a calm flow that works on low bandwidth.",
                image: marketingImages.journeyCheckout,
                alt: "Desk with keyboard, notebook, and payment card",
              },
              {
                step: "03",
                title: "Attend",
                body: "QR in your inbox, tickets in your account, and support when plans change.",
                image: marketingImages.journeyAttend,
                alt: "Audience seated in a conference hall facing a stage",
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
              className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface/55 ring-1 ring-white/[0.06] shadow-sm"
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
        </div>
      </motion.section>

      {/* 6. Social proof */}
      <HomeQuotesAndBuyerSection />

      {/* 7. Organizers */}
      <HomeOrganizerChecklistNewsletter />
    </div>
  );
}
