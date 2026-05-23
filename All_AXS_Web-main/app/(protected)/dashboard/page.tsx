import Link from "next/link";
import { AutoCreatedAccountBanner } from "@/components/dashboard/AutoCreatedAccountBanner";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { FanAccountSummaryCard } from "@/components/dashboard/FanAccountSummaryCard";
import { DashboardWelcomeHeader } from "@/components/dashboard/DashboardWelcomeHeader";
import { DashboardTicketsOverview } from "./DashboardTicketsOverview";
import { DashboardHostingCard } from "./DashboardHostingCard";

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
      { label: "My calendar", href: "/dashboard/calendar", hint: "Upcoming events in one view" },
      { label: "My orders", href: "/dashboard/orders", hint: "Receipts and installment payments" },
      { label: "My refunds", href: "/dashboard/refunds", hint: "Track refund request status" },
    ],
  },
  {
    title: "Account",
    blurb: "View and edit your name, phone, password, notification preferences, or close your fan account.",
    links: [
      { label: "Profile & security", href: "/dashboard/account", hint: "Name, password, close account" },
      { label: "Support", href: "/dashboard/support", hint: "FAQs and contact help" },
    ],
  },
  {
    title: "Discover",
    blurb: "Search published shows, save favourites, and continue to checkout when you are signed in.",
    links: [
      { label: "Browse events", href: "/dashboard/events" },
      { label: "Saved events", href: "/dashboard/saved", hint: "Events you bookmarked" },
    ],
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <DashboardWelcomeHeader />

      <EmailVerificationBanner />
      <AutoCreatedAccountBanner />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <DashboardTicketsOverview />
        <FanAccountSummaryCard />
      </div>

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
          <DashboardHostingCard />
        </ul>
      </section>
    </div>
  );
}
