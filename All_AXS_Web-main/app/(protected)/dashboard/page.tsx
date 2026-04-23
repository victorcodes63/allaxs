import Link from "next/link";
import { DashboardTicketsOverview } from "./DashboardTicketsOverview";

const modules: {
  title: string;
  blurb: string;
  links: { label: string; href: string; hint?: string }[];
}[] = [
  {
    title: "Tickets & entry",
    blurb: "Passes you have bought or received appear here with QR codes for check-in.",
    links: [
      { label: "Open my tickets", href: "/tickets", hint: "List and open each pass" },
    ],
  },
  {
    title: "Discover",
    blurb: "Search published shows, pick a date, and continue to checkout when you are signed in.",
    links: [
      { label: "Browse events", href: "/events" },
      { label: "Home", href: "/" },
    ],
  },
  {
    title: "Hosting",
    blurb: "Sell your own line-ups on All AXS with payouts, ticket types, and review before going live.",
    links: [
      {
        label: "Start organizer setup",
        href: "/organizer/onboarding",
        hint: "Or open Organizer hub if you are already approved",
      },
    ],
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          Dashboard home
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Your fan home
        </h2>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          This space is for people attending events: find tickets, open QR passes, and jump
          back to discovery. When you also host events, use{" "}
          <strong className="font-medium text-foreground">Organizer hub</strong> from the
          sidebar.
        </p>
        <div>
          <Link
            href="/events"
            className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-6 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
          >
            Find events
          </Link>
        </div>
      </header>

      <DashboardTicketsOverview />

      <section aria-labelledby="fan-modules-heading">
        <h3
          id="fan-modules-heading"
          className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-foreground/50"
        >
          What you can do here
        </h3>
        <ul className="grid gap-4 sm:grid-cols-2">
          {modules.map((mod) => (
            <li
              key={mod.title}
              className="flex flex-col rounded-[var(--radius-panel)] border border-border bg-background p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                {mod.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{mod.blurb}</p>
              <div className="mt-4 space-y-3 border-t border-border/80 pt-4">
                {mod.links.map((l) => (
                  <div key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                    >
                      {l.label}
                    </Link>
                    {l.hint ? (
                      <p className="mt-0.5 text-xs text-muted">{l.hint}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
