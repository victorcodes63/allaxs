import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { PAYOUT_POLICY } from "@/lib/legal/policies";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Organizer payout policy | All AXS",
  description: PAYOUT_POLICY.description,
  path: "/payout-policy",
});

export default function PayoutPolicyPage() {
  return <LegalDocumentPage document={PAYOUT_POLICY} />;
}
