import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of service | All AXS",
  description: "Terms governing use of All AXS ticketing services.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Legal</p>
      <h1 className="font-display text-4xl text-foreground mt-2">Terms of service</h1>
      <p className="text-muted text-lg not-prose leading-relaxed mt-4">
        Placeholder summary—replace with counsel-approved copy before launch.
      </p>
      <ul className="list-disc pl-5 space-y-2 text-foreground/90 mt-8">
        <li>Use of the platform, eligibility, and acceptable conduct.</li>
        <li>Ticket purchases, refunds, and chargebacks in line with organizer policies.</li>
        <li>Limitation of liability and dispute resolution.</li>
      </ul>
      <p className="not-prose mt-10">
        <Link href="/" className="text-primary font-semibold hover:underline">
          ← Home
        </Link>
      </p>
    </div>
  );
}
