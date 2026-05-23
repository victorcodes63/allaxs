import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { TERMS_AND_CONDITIONS } from "@/lib/legal/policies";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms & conditions | All AXS",
  description: TERMS_AND_CONDITIONS.description,
  path: "/terms",
});

export default function TermsPage() {
  return <LegalDocumentPage document={TERMS_AND_CONDITIONS} />;
}
