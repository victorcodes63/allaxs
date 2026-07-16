import type { Metadata } from "next";
import { ContactMarketingPage } from "@/components/contact/ContactMarketingPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PLATFORM_SUPPORT_EMAIL } from "@/lib/site-contact";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact | All AXS",
  description:
    `Get in touch with the All AXS team — fan support, organizer inquiries, partnerships, and refunds. Email ${PLATFORM_SUPPORT_EMAIL} or use the form to reach the right person.`,
  path: "/contact",
});

export default function ContactPage() {
  return <ContactMarketingPage />;
}
