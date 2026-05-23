"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/lib/auth";
import { isSaved, toggleSaved } from "@/lib/fan-saved-events";

type SavedEventButtonProps = {
  slug: string;
  /** Overlay on event cards vs inline on detail pages. */
  variant?: "card" | "inline";
  className?: string;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path
        d="M12 20.5s-6.5-4.35-8.8-7.4C1.5 10.4 2.2 7.2 4.8 5.8c1.9-1 4.2-.5 5.7 1.2L12 8.3l1.5-1.3c1.5-1.7 3.8-2.2 5.7-1.2 2.6 1.4 3.3 4.6 1.6 7.3C18.5 16.15 12 20.5 12 20.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SavedEventButton({
  slug,
  variant = "card",
  className = "",
}: SavedEventButtonProps) {
  const { user } = useAuth();
  const userKey = user?.id || user?.email || "";
  const [mounted, setMounted] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted || !userKey || typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("allaxs-fan-saved-events-")) {
        setRevision((n) => n + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mounted, userKey]);

  const saved =
    mounted && userKey ? isSaved(userKey, slug) : false;
  void revision;

  const onToggle = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!userKey) return;
      toggleSaved(userKey, slug);
      setRevision((n) => n + 1);
    },
    [userKey, slug],
  );

  if (!mounted) return null;

  const label = saved ? "Remove from saved events" : "Save event";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        disabled={!userKey}
        className={[
          "inline-flex min-h-[var(--btn-min-h)] items-center justify-center gap-2 rounded-[var(--radius-button)] border px-4 text-sm font-semibold transition-colors",
          saved
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-border bg-background/60 text-foreground hover:border-primary/40 hover:bg-primary/[0.06]",
          !userKey ? "opacity-50 cursor-not-allowed" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <HeartIcon filled={saved} />
        {saved ? "Saved" : "Save event"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={!userKey}
      className={[
        "absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-colors",
        saved
          ? "border-primary/60 bg-primary/90 text-white shadow-md"
          : "border-white/25 bg-black/45 text-white hover:bg-black/60",
        !userKey ? "opacity-50 cursor-not-allowed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
