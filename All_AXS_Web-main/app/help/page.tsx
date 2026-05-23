import type { Metadata } from "next";
import { HelpMarketingPage } from "@/components/help/HelpMarketingPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { HELP_FAQ_SECTIONS } from "@/lib/marketing/help-faq";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Help center | All AXS",
  description:
    "Fan support for All AXS — find your tickets, request refunds, manage payments, and troubleshoot sign-in. Email hello@allaxs.com for further help.",
  path: "/help",
});

function buildFaqJsonLd() {
  const mainEntity = HELP_FAQ_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  );

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

export default function HelpPage() {
  return (
    <>
      <JsonLd id="ld-help-faq" data={buildFaqJsonLd()} />
      <HelpMarketingPage />
    </>
  );
}
