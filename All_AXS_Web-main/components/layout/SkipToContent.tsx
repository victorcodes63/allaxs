/**
 * Keyboard-only "Skip to content" link. Visually hidden until focused, then
 * pinned to the top-left so screen-reader and keyboard users can jump past
 * the marketing/header chrome to `#main-content`.
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:min-h-[3.25rem] focus:items-center focus:justify-center focus:rounded-[var(--radius-button)] focus:bg-primary focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-[var(--btn-shadow-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Skip to content
    </a>
  );
}
