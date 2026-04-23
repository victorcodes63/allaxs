import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy | All AXS",
  description: "How All AXS handles personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Legal</p>
      <h1 className="font-display text-4xl text-foreground mt-2">Privacy policy</h1>
      <p className="text-muted text-lg not-prose leading-relaxed mt-4">
        Placeholder summary—replace with your privacy program and DPA references.
      </p>
      <ul className="list-disc pl-5 space-y-2 text-foreground/90 mt-8">
        <li>What we collect (account, purchase, device) and why.</li>
        <li>How long we retain data and who we share with (processors, payments).</li>
        <li>Your rights and how to contact us.</li>
      </ul>
      <p className="not-prose mt-10">
        <Link href="/" className="text-primary font-semibold hover:underline">
          ← Home
        </Link>
      </p>
    </div>
  );
}
