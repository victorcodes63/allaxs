import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { PRIVACY_POLICY } from "@/lib/legal/policies";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy policy | All AXS",
  description: PRIVACY_POLICY.description,
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalDocumentPage document={PRIVACY_POLICY} />;
}
