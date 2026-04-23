"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { PublicEvent } from "@/lib/utils/api-server";
import { PublicEventCard } from "@/components/events/PublicEventCard";

/**
 * Wide viewports: exactly 3 cards across the rail (container = viewport below).
 * Narrow: one dominant card width for comfortable horizontal swipe.
 */
const CARD =
  "w-[min(92vw,380px)] shrink-0 @[720px]:w-[calc((100cqi-5rem)/3)]";

/** Sticky offset: marketing / signed-in chrome height + device safe area (notch). */
const STICKY_TOP_OFFSET = "calc(4.25rem + env(safe-area-inset-top, 0px))";

/**
 * Vertical scroll distance mapped to full horizontal range — shorter than 1:1 px so the rail
 * doesn’t feel endless on small laptops.
 */
function verticalScrollBudget(maxScroll: number): number {
  if (maxScroll <= 0) return 0;
  return Math.min(620, Math.max(400, Math.round(maxScroll * 0.38)));
}

/** Extra section height so, after the rail reaches its end, the user can scroll a bit more before the block unpins. */
const LAST_CARD_TAIL_SCROLL_PX = 300;

/**
 * Featured strip: scroll progress is tied to the whole block from padded “Scroll to explore”
 * through the card rail (not the cards alone).
 */
export function FeaturedEventsHorizontalSection({ events }: { events: PublicEvent[] }) {
  const reduce = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyShellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const maxScrollRef = useRef(0);
  const horizontalEndProgressRef = useRef(1);
  const [sectionHeight, setSectionHeight] = useState(960);
  const [activeDot, setActiveDot] = useState(0);
  const dotCount = Math.min(8, Math.max(1, events.length));

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const rawX = useTransform(scrollYProgress, (p) => {
    const ms = maxScrollRef.current;
    const end = horizontalEndProgressRef.current;
    if (ms <= 0) return 0;
    if (end >= 0.999) return -p * ms;
    if (p <= end) return -(p / end) * ms;
    return -ms;
  });
  const x = useSpring(rawX, { stiffness: 112, damping: 26, mass: 0.82 });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const end = horizontalEndProgressRef.current;
    const railP = end < 1 && end > 0 ? Math.min(1, p / end) : p;
    const idx = Math.min(dotCount - 1, Math.round(railP * (dotCount - 1)));
    setActiveDot(idx);
  });

  const measure = useCallback(() => {
    const shell = stickyShellRef.current;
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!shell || !track || !vp) return;

    // `clientWidth` includes horizontal padding; children sit in the content box. Without subtracting
    // padding, maxScroll is too small and the last card stays clipped on the right.
    const cs = getComputedStyle(vp);
    const padX = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
    const visible = Math.max(0, vp.clientWidth - padX);
    const overflow = Math.max(0, Math.ceil(track.scrollWidth - visible));
    maxScrollRef.current = overflow;

    const shellH = shell.getBoundingClientRect().height;
    const lift = verticalScrollBudget(overflow);
    const baseH = shellH + lift;
    const vh = window.innerHeight;
    const scrollForHorizontal = baseH - vh;
    const scrollThrough = baseH + LAST_CARD_TAIL_SCROLL_PX - vh;

    if (scrollForHorizontal <= 0 || scrollThrough <= 0) {
      horizontalEndProgressRef.current = 1;
      setSectionHeight(Math.ceil(baseH));
    } else {
      const pEnd = Math.min(1, scrollForHorizontal / scrollThrough);
      horizontalEndProgressRef.current = pEnd;
      setSectionHeight(Math.ceil(baseH + LAST_CARD_TAIL_SCROLL_PX));
    }
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stickyShellRef.current) ro.observe(stickyShellRef.current);
    if (trackRef.current) ro.observe(trackRef.current);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [events, measure]);

  const nudgeScroll = useCallback(
    (dir: -1 | 1) => {
      const el = containerRef.current;
      if (!el) return;
      const range = Math.max(0, el.offsetHeight - window.innerHeight);
      if (range <= 0) return;
      const step = Math.max(120, range / Math.max(5, dotCount * 1.2));
      window.scrollBy({ top: dir * step, behavior: "smooth" });
    },
    [dotCount]
  );

  if (events.length === 0) return null;

  if (reduce) {
    return (
      <div className="space-y-6">
        <div className="border-b border-background pb-3 pt-2 md:pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Scroll to explore · {events.length} events
          </p>
        </div>
        <div className="@container min-w-0 w-full">
          <div
            className="flex gap-7 overflow-x-auto pb-6 pt-1 [scrollbar-width:thin] snap-x snap-mandatory @[720px]:gap-10 md:pb-8"
            aria-label="Featured events"
          >
            {events.map((event) => (
              <div key={event.id} className={`${CARD} snap-start`}>
                <PublicEventCard event={event} variant="featuredRail" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-muted">Swipe sideways to browse featured events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        Scroll-linked region: progress 0→1 runs from the top of this box (padding + toolbar + rail).
        Sticky shell fills the viewport below the header so cards use remaining space under the label.
      */}
      <div
        ref={containerRef}
        className="relative -mx-[var(--axs-page-gutter)] w-[calc(100%+2*var(--axs-page-gutter))] max-w-[100vw] lg:mx-0 lg:w-full"
        style={{ height: sectionHeight }}
        role="region"
        aria-label="Featured events — scroll the page to browse the horizontal list"
      >
        <div
          ref={stickyShellRef}
          className="sticky z-0 flex h-[calc(100svh-4.25rem-env(safe-area-inset-top,0px))] max-h-[820px] min-h-0 flex-col px-[var(--axs-page-gutter)]"
          style={{ top: STICKY_TOP_OFFSET }}
        >
          {/* Tighter top so the sticky rail can use more space for bottom padding around the cards */}
          <div className="shrink-0 pt-2 md:pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background pb-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                Scroll to explore · {events.length} events
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => nudgeScroll(-1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  aria-label="Scroll featured events back"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M14 6l-6 6 6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => nudgeScroll(1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  aria-label="Scroll featured events forward"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M10 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

        <div
          ref={viewportRef}
          className="@container relative -mx-[var(--axs-page-gutter)] flex min-h-0 flex-1 items-center overflow-hidden px-[var(--axs-page-gutter)] pt-1.5 pb-6 md:pb-8"
        >
            <motion.div
              ref={trackRef}
              style={{ x }}
              className="flex w-max gap-7 will-change-transform @[720px]:gap-10"
            >
              {events.map((event) => (
                <div key={event.id} className={CARD}>
                  <PublicEventCard event={event} variant="featuredRail" />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-0.5">
        <div className="flex items-center gap-1.5" aria-label="Featured events position">
          {Array.from({ length: dotCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === activeDot}
              aria-label={`Scroll to featured block ${i + 1} of ${dotCount}`}
              onClick={() => {
                const el = containerRef.current;
                if (!el) return;
                const range = Math.max(0, el.offsetHeight - window.innerHeight);
                const sectionTop = window.scrollY + el.getBoundingClientRect().top;
                const target =
                  sectionTop + (dotCount <= 1 ? 0 : (range * i) / (dotCount - 1));
                window.scrollTo({ top: target, behavior: "smooth" });
              }}
              className={[
                "h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                i === activeDot ? "w-8 bg-primary" : "w-2 bg-border hover:bg-muted",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
