"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowSlot } from "@/components/ui/ArrowCta";

const swapSpring = { type: "spring" as const, stiffness: 420, damping: 32 };

/** Nav / footer text swap — not tied to `--btn-*` pill height */
const ROW_PX_TEXT = 26;

/**
 * Framer-style “swap” hover: first line rolls up, second line takes its place.
 * `look="button"` uses the same padding and min-height as `ArrowCtaLink` (`--btn-*` tokens).
 */
export function SwapCtaLink({
  href,
  line1,
  line2,
  className = "",
  fullWidth = false,
  onClick,
  look = "button",
  trailingArrow = false,
}: {
  href: string;
  line1: string;
  line2: string;
  className?: string;
  fullWidth?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  look?: "button" | "text";
  trailingArrow?: boolean;
}) {
  const reduce = useReducedMotion();

  const rowClass =
    look === "text"
      ? [
          "flex h-full shrink-0 items-center px-0",
          fullWidth ? "justify-center" : "justify-end",
        ].join(" ")
      : "flex h-full shrink-0 items-center justify-center px-0";

  const buttonShell =
    look === "button" &&
    [
      "rounded-[var(--radius-button)] min-h-[var(--btn-min-h)] items-center border px-[var(--btn-pad-x)] py-[var(--btn-pad-y)] text-sm font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out",
      trailingArrow
        ? "arrow-cta group inline-flex gap-1.5 active:scale-[0.99]"
        : "inline-flex active:scale-[0.99]",
    ].join(" ");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
        look === "text" && ["text-sm font-semibold tracking-tight", "rounded-sm", fullWidth ? "text-center" : "text-right"].join(" "),
        buttonShell,
        look === "button" &&
          (fullWidth ? "flex w-full min-w-0 justify-center" : "inline-flex max-w-full align-middle"),
        look === "text" &&
          (fullWidth ? "block w-full min-w-0" : "inline-block max-w-full align-middle"),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {look === "button" ? (
        <>
          <span
            className={[
              "block min-h-0 overflow-hidden",
              trailingArrow ? "min-w-0 flex-1" : "w-full",
              "h-[var(--btn-swap-clip)]",
            ].join(" ")}
          >
            {reduce ? (
              <span className="flex h-full w-full items-center justify-center">
                <span className={rowClass}>{line1}</span>
              </span>
            ) : (
              <motion.span
                className="flex h-[200%] flex-col"
                initial={false}
                whileHover={{ y: "-50%" }}
                transition={swapSpring}
              >
                <span className="flex h-1/2 flex-none items-center justify-center">
                  <span className={rowClass}>{line1}</span>
                </span>
                <span className="flex h-1/2 flex-none items-center justify-center">
                  <span className={rowClass}>{line2}</span>
                </span>
              </motion.span>
            )}
          </span>
          {trailingArrow ? <ArrowSlot /> : null}
        </>
      ) : (
        <span className="block overflow-hidden" style={{ height: ROW_PX_TEXT }}>
          {reduce ? (
            <span className={rowClass} style={{ height: ROW_PX_TEXT }}>
              {line1}
            </span>
          ) : (
            <motion.span
              className="flex flex-col"
              initial={false}
              whileHover={{ y: -ROW_PX_TEXT }}
              transition={swapSpring}
            >
              <span className={rowClass} style={{ height: ROW_PX_TEXT }}>
                {line1}
              </span>
              <span className={rowClass} style={{ height: ROW_PX_TEXT }}>
                {line2}
              </span>
            </motion.span>
          )}
        </span>
      )}
    </Link>
  );
}
