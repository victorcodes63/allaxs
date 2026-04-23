"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CtaArrow } from "@/components/ui/CtaArrow";

const spring = { type: "spring" as const, stiffness: 460, damping: 28 };

/**
 * “Shift” CTA: spring shift left + arrow reveals on hover.
 * Inspired by https://www.framer.com/marketplace/components/shift-button/
 */
export function ShiftCtaLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <Link
      href={href}
      className={[
        "group relative inline-flex max-w-full overflow-hidden rounded-[var(--radius-button)] font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {reduce ? (
        <span className="inline-flex items-center gap-2 px-8 py-3.5">
          {children}
          <CtaArrow className="size-4 shrink-0 opacity-80" />
        </span>
      ) : (
        <motion.span
          className="inline-flex items-center gap-1.5 px-8 py-3.5"
          initial="rest"
          whileHover="hover"
          variants={{
            rest: { x: 0 },
            hover: { x: -6 },
          }}
          transition={spring}
        >
          <span className="whitespace-nowrap">{children}</span>
          <motion.span
            className="flex size-4 shrink-0 items-center justify-center"
            variants={{
              rest: { opacity: 0, x: 12 },
              hover: { opacity: 1, x: 0 },
            }}
            transition={spring}
            aria-hidden
          >
            <CtaArrow className="size-4" />
          </motion.span>
        </motion.span>
      )}
    </Link>
  );
}
