import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { PAYOUT_POLICY } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Organizer payout policy | All AXS",
  description: PAYOUT_POLICY.description,
};

export default function PayoutPolicyPage() {
  return <LegalDocumentPage document={PAYOUT_POLICY} />;
}
