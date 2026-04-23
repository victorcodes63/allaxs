/**
 * Decorative backdrop for sign-in / sign-up (brand glows + soft vignette on dark shell).
 * Fills the flex main region edge-to-edge; parent auth routes use zero horizontal padding in AppChrome.
 * Bottom gradient matches `--footer-panel-bg` so the band blends into `SiteFooter` without a hard seam.
 * With `AppChrome`’s fixed `h-dvh` auth shell, this column scrolls only if the form exceeds the mid band.
 */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 min-h-full min-w-full"
      >
        <div className="absolute -left-[min(28vw,18rem)] -top-[min(22vh,12rem)] h-[min(120vw,72rem)] w-[min(120vw,72rem)] rounded-full bg-primary/24 blur-[140px]" />
        <div className="absolute -right-[min(24vw,14rem)] top-[min(8vh,5rem)] h-[min(100vw,60rem)] w-[min(100vw,60rem)] rounded-full bg-accent-purple/30 blur-[150px]" />
        <div className="absolute bottom-[-min(20vh,10rem)] left-[min(8vw,2rem)] h-[min(90vw,52rem)] w-[min(90vw,52rem)] rounded-full bg-primary-dark/22 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-5%,rgba(240,114,65,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_105%,rgba(96,24,72,0.16),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0)_0%,rgba(9,9,11,0.35)_72%,rgba(9,9,11,0.72)_100%)]" />
      </div>

      {/* Feather into footer panel — same token as SiteFooter top surface */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(11rem,22vh)] md:h-[min(13rem,26vh)]"
        style={{
          background:
            "linear-gradient(to top, var(--footer-panel-bg) 0%, color-mix(in srgb, var(--footer-panel-bg) 72%, transparent) 42%, color-mix(in srgb, var(--footer-panel-bg) 18%, transparent) 78%, transparent 100%)",
        }}
      />

      <div className="relative z-[2] flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          <div className="my-auto flex w-full flex-col py-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
