import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { REFUND_POLICY } from "@/lib/legal/policies";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Refund & cancellation policy | All AXS",
  description: REFUND_POLICY.description,
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return <LegalDocumentPage document={REFUND_POLICY} />;
}
