interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Wider card for intent rail + form (login / register). */
  wide?: boolean;
  /** Editorial header for split auth screens; narrow flows stay centered. */
  headerAlign?: "center" | "start";
}

export function AuthCard({
  title,
  subtitle,
  children,
  wide = false,
  headerAlign = "center",
}: AuthCardProps) {
  const align = wide ? headerAlign : "center";
  const shell = wide
    ? "rounded-[var(--radius-panel)] border border-border/70 bg-surface/95 p-7 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-[2px] sm:p-9"
    : "rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.45)] sm:p-7";

  const headerWide = wide && align === "center";
  const headerWrapperClass =
    align === "start"
      ? "space-y-2.5 border-b border-border/50 pb-6 text-left sm:pb-7"
      : headerWide
        ? "space-y-2.5 border-b border-border/50 pb-6 text-center sm:pb-7"
        : "space-y-2 text-center";

  const titleClass =
    align === "start" || headerWide
      ? "font-display text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]"
      : "text-3xl font-bold text-foreground";

  const subtitleClass =
    align === "start"
      ? "max-w-xl text-[0.9375rem] leading-relaxed text-muted sm:text-[15px]"
      : headerWide
        ? "mx-auto max-w-xl text-[0.9375rem] leading-relaxed text-muted sm:text-[15px]"
        : "text-sm text-muted";

  return (
    <div className={`mx-auto w-full ${wide ? "max-w-[min(100%,52rem)]" : "max-w-md"}`}>
      <div className={`${wide ? "space-y-6 sm:space-y-7" : "space-y-5"} ${shell}`}>
        <div className={headerWrapperClass}>
          <h1 className={titleClass}>{title}</h1>
          {subtitle && <p className={subtitleClass}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

