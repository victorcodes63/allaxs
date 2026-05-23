import type { LegalLink } from "@/lib/legal/types";

/** Shared legal routes — public pages and hub sidebars. */
export const LEGAL_LINKS: LegalLink[] = [
  { href: "/terms", label: "Terms & conditions", shortLabel: "Terms" },
  { href: "/privacy", label: "Privacy policy", shortLabel: "Privacy" },
  { href: "/refund-policy", label: "Refund & cancellation", shortLabel: "Refunds" },
  {
    href: "/payout-policy",
    label: "Organizer payout policy",
    shortLabel: "Payouts",
  },
];

export const LEGAL_OFFICE_ADDRESS =
  "8th Floor, Kofisi, Riverside Drive, P.O. Box 59105, Riverside, Nairobi";
