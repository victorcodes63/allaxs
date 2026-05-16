/**
 * Decorative backdrop for sign-in / sign-up. Fits inside AppChrome’s fixed `h-dvh`
 * auth shell — no internal scroll; content must stay within the mid band.
 */
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <AuthBackdrop />
      <AuthFooterFeather />
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-[min(100%,26rem)] px-4 py-2 sm:px-5 sm:py-3">{children}</div>
      </div>
    </div>
  );
}

function AuthBackdrop() {
  return (
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
  );
}

function AuthFooterFeather() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(8rem,16vh)] md:h-[min(9rem,18vh)]"
      style={{
        background:
          "linear-gradient(to top, var(--footer-panel-bg) 0%, color-mix(in srgb, var(--footer-panel-bg) 72%, transparent) 42%, transparent 100%)",
      }}
    />
  );
}
