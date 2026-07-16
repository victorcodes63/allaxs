import Link from "next/link";
import { buildHubLegalLinks } from "@/lib/legal/hub-paths";
import { HOST_FAQ_SECTIONS } from "@/lib/marketing/host-faq";
import {
  PLATFORM_SUPPORT_EMAIL,
  platformSupportMailto,
} from "@/lib/site-contact";

export default function OrganizerSupportPage() {
  const legalLinks = buildHubLegalLinks("/organizer");

  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Help</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Help &amp; support
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Answers about publishing events, payouts, refunds, and door scan setup. Need hands-on
          help? Email our team with your organization name and event title.
        </p>
      </header>

      <section
        aria-labelledby="contact-heading"
        className="rounded-[var(--radius-panel)] border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-surface/90 p-5 sm:p-6"
      >
        <h2
          id="contact-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Contact support
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Include your organization name and event title (or order ID for refund questions). We
          typically respond within one business day.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={platformSupportMailto({ subject: "All AXS organizer support" })}
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Email {PLATFORM_SUPPORT_EMAIL}
          </a>
          <Link
            href="/organizer/refunds"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
          >
            Refunds
          </Link>
          <Link
            href="/organizer/earnings"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
          >
            Earnings &amp; payouts
          </Link>
          <Link
            href="/organizer/account"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
          >
            Account &amp; profile
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {HOST_FAQ_SECTIONS.map((section) => (
          <section
            key={section.id}
            aria-labelledby={`faq-${section.id}`}
            className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
          >
            <h2
              id={`faq-${section.id}`}
              className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
            >
              {section.title}
            </h2>
            <ul className="mt-4 space-y-4">
              {section.items.map((item) => (
                <li key={item.q} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section
        aria-labelledby="legal-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/60 p-5 sm:p-6"
      >
        <h2
          id="legal-heading"
          className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          Policies &amp; legal
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Official terms, privacy, and payout policies for organizers on All AXS.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {legalLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
