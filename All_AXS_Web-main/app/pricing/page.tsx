import type { Metadata } from "next";
import { PricingMarketingPage } from "@/components/pricing/PricingMarketingPage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing | All AXS",
  description:
    "All AXS is free to list. A platform fee is deducted from organizer proceeds — never added on top for fans. Payments via Paystack; payouts 5–10 business days after the event.",
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingMarketingPage />;
}
