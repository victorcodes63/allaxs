import Link from "next/link";
import { buildHubLegalLinks } from "@/lib/legal/hub-paths";

const FAQ_SECTIONS = [
  {
    id: "refunds",
    title: "Refunds & cancellations",
    items: [
      {
        q: "How do I request a refund?",
        a: "Open the order from My orders, scroll to Request a refund, and submit your reason. An admin reviews every request — approval is not automatic.",
      },
      {
        q: "How long do refunds take?",
        a: "Approved refunds typically arrive within 7–14 business days for mobile money and 7–21 days for card payments, depending on your provider.",
      },
      {
        q: "Where can I track refund status?",
        a: "Check My refunds in your fan dashboard for every request linked to your account, or open the original order for full details.",
      },
    ],
  },
  {
    id: "tickets",
    title: "Tickets & entry",
    items: [
      {
        q: "Where are my passes after checkout?",
        a: "Digital passes appear in My tickets immediately after payment. We also email a PDF backup to your receipt address.",
      },
      {
        q: "Can I transfer a ticket to someone else?",
        a: "Open the pass in My tickets and use Transfer ticket to send it to another email. The recipient gets the QR pass under their account if they sign up with that address.",
      },
      {
        q: "What should I bring to the venue?",
        a: "Show the QR code from your pass in the All AXS wallet or the PDF we emailed. Arrive early for smooth check-in.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & sign-in",
    items: [
      {
        q: "I bought tickets as a guest — how do I sign in?",
        a: "Use the same email from checkout. If you did not set a password, choose Forgot password on the sign-in page to create one.",
      },
      {
        q: "How do I update my name or phone?",
        a: "Go to Account in your fan dashboard and save your profile. Your email is your username and cannot be changed here.",
      },
      {
        q: "How do I close my account?",
        a: "Open Account, scroll to Close account, and follow the confirmation steps. Tickets already issued remain valid for entry.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & receipts",
    items: [
      {
        q: "Which payment methods are supported?",
        a: "We support card and mobile money through Paystack where enabled for the event. Available options appear at checkout.",
      },
      {
        q: "Where is my receipt?",
        a: "Every completed order is listed under My orders with payment reference, amount, and a link to resend your receipt email.",
      },
      {
        q: "My payment succeeded but I have no tickets",
        a: "Refresh My tickets and check your spam folder. If passes still do not appear within a few minutes, contact support with your payment reference.",
      },
    ],
  },
] as const;

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
            href="mailto:hello@allaxs.com?subject=All%20AXS%20fan%20support"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white"
          >
            Email hello@allaxs.com
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
