"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type DialogSize = "md" | "lg" | "xl";

const SIZE_CLASS: Record<DialogSize, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  size?: DialogSize;
  /** Use full viewport height on small screens (moderation, long forms). */
  mobileSheet?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  ariaLabel,
  size = "md",
  mobileSheet = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const firstFocusable = dialogRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) as HTMLElement;
      firstFocusable?.focus();

      const handleTab = (e: KeyboardEvent) => {
        if (!dialogRef.current) return;

        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.key === "Tab") {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener("keydown", handleTab);

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("keydown", handleTab);
        document.removeEventListener("keydown", handleEscape);
        previousFocusRef.current?.focus();
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const panelClass = [
    "flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg",
    SIZE_CLASS[size],
    mobileSheet
      ? "max-h-[min(92dvh,100%)] sm:max-h-[90vh]"
      : "max-h-[90vh]",
    mobileSheet ? "max-sm:min-h-[min(88dvh,100%)] max-sm:rounded-t-2xl" : "",
  ].join(" ");

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex bg-black/50 p-4",
        mobileSheet ? "items-end sm:items-center" : "items-center justify-center",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={panelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border p-4 sm:p-6">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
