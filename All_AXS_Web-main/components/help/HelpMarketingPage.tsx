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
import { HELP_FAQ_SECTIONS } from "@/lib/marketing/help-faq";
import {
  PLATFORM_SUPPORT_EMAIL,
  platformSupportMailto,
} from "@/lib/site-contact";

/** Vertical rhythm between major page sections — matches `OrganizersMarketingPage`. */
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

function HelpParallaxHero() {
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
      <div className="relative min-h-[min(72vh,620px)] w-full">
        <motion.div className="absolute inset-0 h-[115%] w-full -top-[8%]" style={{ y }}>
          <Image
            src={marketingImages.homeHero}
            alt="Supportive team helping fans get the most out of their event tickets"
            fill
            priority
            unoptimized={shouldUnoptimizeEventImage(marketingImages.homeHero)}
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
          className="relative z-10 flex min-h-[min(72vh,620px)] flex-col justify-end pb-14 pt-24 md:pb-20 md:pt-28"
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
                  Help center
                </motion.p>
                <motion.h1
                  variants={fadeUp(reduce, 0.05)}
                  className="font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.15rem]"
                >
                  Answers for fans — tickets, refunds, payments, and your account
                </motion.h1>
                <motion.p
                  variants={fadeUp(reduce, 0.1)}
                  className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl"
                >
                  Everything you need to find your passes, troubleshoot a payment, or request a refund.
                  Still stuck? Our team is one email away and usually replies the same business day.
                </motion.p>
                <motion.div
                  variants={fadeUp(reduce, 0.15)}
                  className="flex flex-wrap gap-4 pt-2"
                >
                  <ArrowCtaLink
                    href={platformSupportMailto({ subject: "All AXS fan support" })}
                    variant="primary"
                    className="justify-center"
                  >
                    Email {PLATFORM_SUPPORT_EMAIL}
                  </ArrowCtaLink>
                  <ArrowCtaLink href="/login" variant="outline" className="justify-center">
                    Sign in to your account
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

const QUICK_LINKS = [
  {
    title: "Find a ticket",
    body: "Tickets land in My tickets right after payment. Use the same email you checked out with.",
    href: "/login",
    cta: "Sign in to view",
  },
  {
    title: "Track a refund",
    body: "All refund requests are reviewed by an admin. Track status under My refunds in your fan dashboard.",
    href: "/refund-policy",
    cta: "Read refund policy",
  },
  {
    title: "Payment trouble",
    body: "If a charge succeeded but no passes arrived, contact us with your payment reference — we'll trace it fast.",
    href: platformSupportMailto({ subject: "Payment issue" }),
    cta: "Email support",
  },
] as const;

function QuickHelpBand({ reduce }: { reduce: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="quick-help-heading">
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
              id="quick-help-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
            >
              Start here
            </motion.p>
            <motion.h2
              variants={fadeUp(reduce, 0.05)}
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
            >
              The three things fans ask first
            </motion.h2>
            <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
              Quick answers for the most common situations. If your question is more specific, scan the
              FAQ below or send us a note with your order reference.
            </motion.p>
          </motion.div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((item, i) => (
              <motion.li
                key={item.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-30px" }}
                variants={fadeUp(reduce, i * 0.05)}
                className="flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm"
              >
                <p className="font-display font-semibold text-foreground">{item.title}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{item.body}</p>
                <div className="mt-5">
                  <Link
                    href={item.href}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {item.cta} →
                  </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FaqAccordion({ reduce }: { reduce: boolean }) {
  const allItems = HELP_FAQ_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ ...item, sectionTitle: section.title, sectionId: section.id })),
  );
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
              Fan questions, answered
            </motion.h2>
            <motion.p
              variants={fadeUp(reduce, 0.1)}
              className="mt-4 text-muted text-lg leading-relaxed"
            >
              These cover refunds, tickets, accounts, and payments. Anything missing? Drop us a line at{" "}
              <a
                href={platformSupportMailto()}
                className="font-semibold text-primary hover:underline"
              >
                {PLATFORM_SUPPORT_EMAIL}
              </a>
              .
            </motion.p>
          </motion.div>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              className="space-y-3"
            >
              <motion.p
                variants={fadeUp(reduce)}
                className="text-xs font-semibold uppercase tracking-[0.22em] text-muted"
              >
                Browse by topic
              </motion.p>
              <ul className="space-y-2">
                {HELP_FAQ_SECTIONS.map((section) => (
                  <motion.li key={section.id} variants={fadeUp(reduce)}>
                    <a
                      href={`#section-${section.id}`}
                      className="block rounded-[var(--radius-card)] border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/45 hover:text-primary-dark"
                    >
                      {section.title}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.ul
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
              className="w-full space-y-3"
              aria-label="Frequently asked questions"
            >
              {allItems.map((item, i) => {
                const isOpen = open === i;
                const previousSectionId = i > 0 ? allItems[i - 1].sectionId : null;
                const showSectionHeading = item.sectionId !== previousSectionId;
                return (
                  <motion.li
                    key={`${item.sectionId}-${item.q}`}
                    variants={fadeUp(reduce)}
                    className="w-full"
                    id={showSectionHeading ? `section-${item.sectionId}` : undefined}
                  >
                    {showSectionHeading ? (
                      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted first:mt-0">
                        {item.sectionTitle}
                      </p>
                    ) : null}
                    <div className="w-full rounded-[var(--radius-card)] border border-border bg-surface">
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
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactBand({ reduce }: { reduce: boolean }) {
  return (
    <section className="mb-6 md:mb-10" aria-labelledby="contact-heading">
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
                id="contact-heading"
                className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
              >
                Still need help?
              </motion.p>
              <motion.h2
                variants={fadeUp(reduce, 0.05)}
                className="font-display text-3xl font-semibold text-foreground md:text-4xl"
              >
                Email the team — include your order reference
              </motion.h2>
              <motion.p
                variants={fadeUp(reduce, 0.1)}
                className="text-muted text-lg leading-relaxed"
              >
                We aim to respond within one business day. Need formal refund terms or escalation paths?
                Read the full{" "}
                <Link href="/refund-policy" className="font-semibold text-primary hover:underline">
                  refund &amp; cancellation policy
                </Link>
                .
              </motion.p>
            </div>
            <motion.div
              variants={fadeUp(reduce, 0.12)}
              className="flex shrink-0 flex-col gap-3 sm:flex-row"
            >
              <ArrowCtaLink
                href={platformSupportMailto({ subject: "All AXS fan support" })}
                variant="primary"
                className="justify-center"
              >
                {PLATFORM_SUPPORT_EMAIL}
              </ArrowCtaLink>
              <ArrowCtaLink href="/contact" variant="outline" className="justify-center">
                Contact form
              </ArrowCtaLink>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function HelpMarketingPage() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div>
      <HelpParallaxHero />
      <QuickHelpBand reduce={reduce} />
      <FaqAccordion reduce={reduce} />
      <ContactBand reduce={reduce} />
    </div>
  );
}
