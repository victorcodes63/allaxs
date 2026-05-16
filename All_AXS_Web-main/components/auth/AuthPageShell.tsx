/**
 * Decorative backdrop for sign-in / sign-up. Fixed gradient layer stays visible while
 * the page scrolls on smaller viewports.
 */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex w-full flex-1 flex-col">
      <AuthBackdrop />
      <AuthFooterFeather />
      <div className="relative z-[2] flex min-h-[calc(100dvh-12rem)] w-full flex-col items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
        <div className="mx-auto w-full max-w-[min(100%,26rem)]">{children}</div>
      </div>
    </div>
  );
}

function AuthBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-[#09090b]">
      <div className="absolute -left-[min(28vw,18rem)] -top-[min(22vh,12rem)] h-[min(120vw,72rem)] w-[min(120vw,72rem)] rounded-full bg-primary/24 blur-[140px]" />
      <div className="absolute -right-[min(24vw,14rem)] top-[min(8vh,5rem)] h-[min(100vw,60rem)] w-[min(100vw,60rem)] rounded-full bg-accent-purple/30 blur-[150px]" />
      <div className="absolute bottom-[-min(20vh,10rem)] left-[min(8vw,2rem)] h-[min(90vw,52rem)] w-[min(90vw,52rem)] rounded-full bg-primary-dark/22 blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-5%,rgba(240,114,65,0.22),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_105%,rgba(96,24,72,0.2),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0)_0%,rgba(9,9,11,0.28)_70%,rgba(9,9,11,0.65)_100%)]" />
    </div>
  );
}

/** Blends the scrollable footer into the panel — sits under the footer (z-20). */
function AuthFooterFeather() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[5] h-[min(10rem,20vh)]"
      style={{
        background:
          "linear-gradient(to top, #0c0c0f 0%, color-mix(in srgb, #0c0c0f 75%, transparent) 45%, transparent 100%)",
      }}
    />
  );
}
