"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

function IconModerated({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheckout({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M2 10h20"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M6 15h4M14 15h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconQr({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M15 15h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const pillars = [
  {
    title: "Moderated listings",
    body: "Events are reviewed before they go live so buyers see listings that meet platform standards.",
    Icon: IconModerated,
  },
  {
    title: "Transparent checkout",
    body: "Tiers, fees, and totals are clear before payment—built for teams who care about trust as much as turnout.",
    Icon: IconCheckout,
  },
  {
    title: "QR at the door",
    body: "Delegates get passes in their inbox and account, ready when Wi‑Fi and queues don’t cooperate.",
    Icon: IconQr,
  },
] as const;

/**
 * Short “about” band between the full-bleed hero and deeper home sections (calendar, venue story).
 */
export function HomeAboutIntro() {
  const reduce = useReducedMotion();

  return (
    <motion.section
      id="about"
      aria-labelledby="home-about-heading"
      className="border-t border-border/50 bg-background py-16 md:py-24"
      initial={reduce ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px", amount: 0.12 }}
      transition={{ duration: 0.65, ease }}
    >
      <div className="axs-page-shell">
        <div className="axs-content-inner grid gap-12 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] md:items-start md:gap-14 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">About All AXS</p>
            <h2
              id="home-about-heading"
              className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.6rem] md:leading-[1.12]"
            >
              Corporate events deserve the same clarity as the keynote slide deck
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              All AXS started from a simple idea—<span className="text-foreground/90">all access</span> to
              discovery, purchase, and entry. We build calm rails for organisers and delegates: structured
              listings, honest fees, and check-in that still works when the room is full and the network is not.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Whether you run a forum in Nairobi or a hybrid summit across time zones, the goal is the same: one
              place to publish, sell, and settle—without the chaos.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/organizers"
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border-2 border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/8"
              >
                For organisers
              </Link>
              <Link
                href="/events"
                className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-[var(--btn-shadow-outline)] transition-colors hover:bg-wash"
              >
                Browse events
              </Link>
            </div>
          </div>

          <ul className="flex flex-col gap-4">
            {pillars.map((item, i) => {
              const Icon = item.Icon;
              return (
                <motion.li
                  key={item.title}
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : 0.06 * i, ease }}
                  className="rounded-[var(--radius-card)] border border-border/70 bg-surface/50 p-5 ring-1 ring-white/[0.04] md:p-6"
                >
                  <div className="mb-3 flex items-center gap-3 md:mb-3.5 md:gap-4">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20"
                      aria-hidden
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </div>
                    <p className="min-w-0 flex-1 font-display text-lg font-semibold leading-snug text-foreground">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{item.body}</p>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
