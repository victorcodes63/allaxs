import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { TERMS_AND_CONDITIONS } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Terms & conditions | All AXS",
  description: TERMS_AND_CONDITIONS.description,
};

export default function TermsPage() {
  return <LegalDocumentPage document={TERMS_AND_CONDITIONS} />;
}
