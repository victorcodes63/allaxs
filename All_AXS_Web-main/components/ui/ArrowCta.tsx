"use client";

import Link from "next/link";
import { CtaArrow } from "@/components/ui/CtaArrow";

/** Base classes for links/buttons — tokens in `app/globals.css` (`--btn-*`). */
export const axsCtaBaseClass =
  "arrow-cta group inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-button)] min-h-[var(--btn-min-h)] px-[var(--btn-pad-x)] py-[var(--btn-pad-y)] text-sm font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";

const axsCtaCompactClass = "!px-[var(--btn-pad-x-compact)]";

export function ArrowSlot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative ml-0.5 inline-flex size-4 shrink-0 items-center justify-center overflow-hidden ${className}`}
      aria-hidden
    >
      <span className="arrow-cta-out absolute inset-0 flex items-center justify-center">
        <CtaArrow className="size-3.5" />
      </span>
      <span className="arrow-cta-in absolute inset-0 flex items-center justify-center">
        <CtaArrow className="size-3.5" />
      </span>
    </span>
  );
}

/** Left-pointing arrow slot for back links (pairs with `.arrow-cta-back` in `globals.css`). */
export function ArrowBackSlot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative mr-0.5 inline-flex size-4 shrink-0 items-center justify-center overflow-hidden ${className}`}
      aria-hidden
    >
      <span className="arrow-cta-out absolute inset-0 flex items-center justify-center">
        <CtaArrow className="size-3.5 rotate-180" />
      </span>
      <span className="arrow-cta-in absolute inset-0 flex items-center justify-center">
        <CtaArrow className="size-3.5 rotate-180" />
      </span>
    </span>
  );
}

export type ArrowCtaVariant = "primary" | "secondary" | "outline" | "ghost";

const variantClass: Record<ArrowCtaVariant, string> = {
  primary:
    "border border-transparent bg-primary text-white shadow-[var(--btn-shadow-primary)] hover:bg-primary-dark hover:shadow-[0_6px_20px_-6px_rgba(192,41,66,0.4),0_2px_8px_-4px_rgba(0,0,0,0.1)] active:scale-[0.99]",
  secondary:
    "border border-transparent bg-foreground text-background shadow-sm hover:bg-foreground/90 active:scale-[0.99]",
  outline:
    "border border-border bg-surface text-foreground shadow-[var(--btn-shadow-outline)] hover:border-primary/45 hover:bg-primary/5 hover:text-primary-dark active:scale-[0.99]",
  ghost:
    "border border-transparent text-foreground hover:bg-wash active:scale-[0.99]",
};

export type ArrowCtaSize = "default" | "compact";

function sizeClass(size: ArrowCtaSize): string {
  return size === "compact" ? axsCtaCompactClass : "";
}

/**
 * Sliding `CtaArrow` icon; hover motion from `.arrow-cta` in `globals.css`.
 */
export function ArrowCtaLink({
  href,
  children,
  variant = "primary",
  size = "default",
  className = "",
  fullWidth = false,
  onClick,
  "aria-label": ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ArrowCtaVariant;
  size?: ArrowCtaSize;
  className?: string;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        axsCtaBaseClass,
        sizeClass(size),
        variantClass[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      <ArrowSlot />
    </Link>
  );
}

/** Ghost-style back link with the same arrow micro-interaction as `ArrowCtaLink`, reversed. */
export function ArrowBackCtaLink({
  href,
  children,
  size = "default",
  className = "",
  fullWidth = false,
  "aria-label": ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  size?: ArrowCtaSize;
  className?: string;
  fullWidth?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={[
        axsCtaBaseClass,
        "arrow-cta-back",
        sizeClass(size),
        variantClass.ghost,
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ArrowBackSlot />
      {children}
    </Link>
  );
}

export function ArrowButton({
  children,
  variant = "primary",
  size = "default",
  className = "",
  fullWidth = false,
  type = "button",
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ArrowCtaVariant;
  size?: ArrowCtaSize;
  fullWidth?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        axsCtaBaseClass,
        sizeClass(size),
        variantClass[variant],
        fullWidth ? "w-full" : "",
        "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
      <ArrowSlot />
    </button>
  );
}
