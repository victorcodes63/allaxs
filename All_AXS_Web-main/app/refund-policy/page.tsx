import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { REFUND_POLICY } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Refund & cancellation policy | All AXS",
  description: REFUND_POLICY.description,
};

export default function RefundPolicyPage() {
  return <LegalDocumentPage document={REFUND_POLICY} />;
}
