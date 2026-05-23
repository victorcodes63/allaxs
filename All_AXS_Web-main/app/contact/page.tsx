import type { Metadata } from "next";
import { ContactMarketingPage } from "@/components/contact/ContactMarketingPage";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact | All AXS",
  description:
    "Get in touch with the All AXS team — fan support, organizer inquiries, partnerships, and refunds. Email hello@allaxs.com or use the form to reach the right person.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactMarketingPage />;
}
