export type PolicyBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export type PolicySection = {
  id: string;
  title: string;
  blocks: PolicyBlock[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  lastUpdated?: string;
  sections: PolicySection[];
};

export type LegalLink = {
  href: string;
  label: string;
  shortLabel?: string;
};
