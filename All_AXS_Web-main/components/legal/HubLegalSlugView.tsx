import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCUMENTS } from "@/lib/legal/policies";
import {
  buildHubLegalLinks,
  hubLegalBackHref,
  type HubLegalPrefix,
} from "@/lib/legal/hub-paths";

const BACK_LABELS: Record<HubLegalPrefix, string> = {
  "/dashboard": "← Back to overview",
  "/organizer": "← Back to host overview",
  "/admin": "← Back to admin overview",
};

type HubLegalSlugViewProps = {
  prefix: HubLegalPrefix;
  slug: string;
};

export function HubLegalSlugView({ prefix, slug }: HubLegalSlugViewProps) {
  const document = LEGAL_DOCUMENTS[slug];

  return (
    <LegalDocumentPage
      document={document}
      links={buildHubLegalLinks(prefix)}
      backHref={hubLegalBackHref(prefix)}
      backLabel={BACK_LABELS[prefix]}
    />
  );
}
