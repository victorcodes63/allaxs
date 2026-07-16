import Link from "next/link";
import { buildHubLegalLinks } from "@/lib/legal/hub-paths";
import { HELP_FAQ_SECTIONS } from "@/lib/marketing/help-faq";
import {
  PLATFORM_SUPPORT_EMAIL,
  platformSupportMailto,
} from "@/lib/site-contact";

const FAQ_SECTIONS = HELP_FAQ_SECTIONS;

export default function FanSupportPage() {
  const legalLinks = buildHubLegalLinks("/dashboard");

  return (
    <div className="space-y-10 pb-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Help</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Support center
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Answers to common questions about tickets, refunds, payments, and your account. Need
          something else? Our team is one email away.
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
          Include your order reference or event name so we can help faster. We typically respond
          within one business day.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={platformSupportMailto({ subject: "All AXS fan support" })}
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Email {PLATFORM_SUPPORT_EMAIL}
          </a>
          <Link
            href="/dashboard/refunds"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
          >
            My refunds
          </Link>
          <Link
            href="/dashboard/orders"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/35"
          >
            My orders
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {FAQ_SECTIONS.map((section) => (
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
          Official terms, privacy, and refund policies for tickets purchased on All AXS.
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
