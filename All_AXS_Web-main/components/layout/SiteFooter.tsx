import Image from "next/image";
import Link from "next/link";
import { CtaArrow } from "@/components/ui/CtaArrow";
import { FooterBackToTop } from "@/components/layout/FooterBackToTop";
import { FooterStayInTheLoop } from "@/components/layout/FooterStayInTheLoop";

const FOOTER_NAV = [
  ["/", "Home"],
  ["/events", "Events"],
  ["/tickets", "Tickets"],
  ["/organizers", "For organizers"],
  ["/register", "Sell tickets"],
  ["/login", "Sign in"],
] as const;

const CONTACT_EMAIL = "hello@allaxs.com";

/** Soft, full-width blurred arc (orange → red → purple); eased with white + lower opacity. */
function GradientArc() {
  const w = "14%";
  const mix = (c: string) => `color-mix(in srgb, ${c} 86%, white ${w})`;
  return (
    <div
      className="pointer-events-none absolute -left-[15%] -right-[15%] bottom-[-45%] h-[min(72vw,640px)] opacity-[0.68] blur-[80px] sm:blur-[100px] md:blur-[120px]"
      aria-hidden
      style={{
        background: `linear-gradient(115deg, ${mix("var(--primary)")} 0%, ${mix("var(--primary-dark)")} 38%, ${mix("var(--accent-purple)")} 68%, ${mix("color-mix(in srgb, var(--primary) 55%, var(--accent-purple) 45%)")} 100%)`,
        borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
      }}
    />
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto font-sans">
      <div className="axs-footer-panel relative overflow-hidden bg-(--footer-panel-bg) text-foreground">
        <GradientArc />

        <div className="axs-page-shell relative z-10 py-12 md:py-16 lg:py-20">
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-12">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/55 md:text-[11px]">
                Contact
              </p>
              <h2 className="font-display mt-3 text-4xl uppercase leading-[0.95] tracking-tight sm:text-5xl md:text-6xl lg:text-[3.35rem] xl:text-[3.75rem]">
                Get in touch
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/65 md:text-lg">
                Questions about events, payouts, or partnerships — we&apos;re building ticketing that
                respects both fans and organizers across Africa.
              </p>

              <div className="mt-12 space-y-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground">
                    Email
                  </p>
                  <div className="mt-3 border-b border-foreground/25 pb-2">
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="text-sm font-medium text-foreground/70 transition-colors hover:text-primary/90 md:text-base"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground">
                    Start today
                  </p>
                  <div className="mt-3 border-b border-foreground/25 pb-2">
                    <Link
                      href="/events"
                      className="group inline-flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-foreground"
                    >
                      <span>Explore events</span>
                      <span className="relative top-px inline-flex size-4 items-center justify-center">
                        <CtaArrow className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <nav
              className="flex shrink-0 flex-col gap-3 lg:items-end lg:pt-2 lg:text-right"
              aria-label="Footer"
            >
              {FOOTER_NAV.map(([href, label]) => (
                <Link
                  key={href + label}
                  href={href}
                  className="group relative w-fit font-medium uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:text-primary-dark/88 lg:ml-auto"
                >
                  {label}
                  <span
                    className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-primary/85 transition-transform group-hover:scale-x-100 lg:left-auto lg:right-0 lg:origin-right"
                    aria-hidden
                  />
                </Link>
              ))}
            </nav>
          </div>

          <div className="relative mt-12 grid grid-cols-1 gap-8 border-t border-foreground/10 pt-8 md:mt-14 md:grid-cols-[minmax(0,1.15fr)_auto] md:items-end md:gap-8 md:pt-9 lg:mt-16">
            <FooterStayInTheLoop />

            <div className="flex flex-col items-end gap-3 md:justify-self-end md:text-right">
              <Link href="/" className="inline-block opacity-95 transition-opacity hover:opacity-100">
                <Image
                  src="/brand/logo-header.png"
                  alt="All AXS"
                  width={220}
                  height={52}
                  className="h-10 w-auto max-w-[min(100%,220px)] object-contain object-right sm:h-11 sm:max-w-[240px]"
                />
              </Link>
              <FooterBackToTop className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/55 underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-foreground text-white">
        <div className="axs-page-shell flex flex-col gap-4 py-4 text-[10px] uppercase tracking-[0.2em] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/privacy" className="text-white/75 transition-colors hover:text-primary/85">
              Privacy policy
            </Link>
            <Link href="/terms" className="text-white/75 transition-colors hover:text-primary/85">
              Terms of service
            </Link>
          </div>
          <p className="text-white/55 sm:text-center">
            © {year} All AXS. <span className="text-white/40">All rights reserved.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
