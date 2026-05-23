import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { PRIVACY_POLICY } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Privacy policy | All AXS",
  description: PRIVACY_POLICY.description,
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={PRIVACY_POLICY} />;
}
