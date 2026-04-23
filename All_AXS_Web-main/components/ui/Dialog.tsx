"use client";

import { useEffect, useRef, ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  ariaLabel,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the dialog
      const firstFocusable = dialogRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();

      // Trap focus within dialog
      const handleTab = (e: KeyboardEvent) => {
        if (!dialogRef.current) return;

        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.key === "Tab") {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleTab);

      // Handle Escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("keydown", handleTab);
        document.removeEventListener("keydown", handleEscape);
        // Restore focus to previous element
        previousFocusRef.current?.focus();
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-black/10">
          <h2 className="text-2xl font-bold text-black">{title}</h2>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="p-6 border-t border-black/10 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

