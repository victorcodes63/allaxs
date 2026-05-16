interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Login / register — same narrow editorial width. */
  wide?: boolean;
}

const CARD_MAX = "max-w-[min(100%,24rem)]";

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className={`mx-auto w-full ${CARD_MAX}`}>
      <div
        className={[
          "space-y-5 rounded-2xl border border-white/[0.08] bg-surface/90 p-6",
          "shadow-[0_24px_64px_-32px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)_inset]",
          "backdrop-blur-md sm:p-7",
        ].join(" ")}
      >
        <header className="space-y-1.5 text-center">
          <h1 className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[12px] leading-snug tracking-wide text-muted/90">{subtitle}</p>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}
