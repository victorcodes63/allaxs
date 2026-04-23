"use client";

export function FooterBackToTop({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--footer-panel-bg) ${className}`}
      onClick={() => {
        const instant =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
      }}
    >
      Back to top
    </button>
  );
}
