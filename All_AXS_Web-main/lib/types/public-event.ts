export interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  type: "IN_PERSON" | "VIRTUAL" | "HYBRID";
  venue?: string;
  city?: string;
  country?: string;
  startAt: string;
  endAt: string;
  bannerUrl?: string | null;
  organizer: {
    id: string;
    orgName: string;
  };
  ticketTypes?: Array<{
    id: string;
    name: string;
    description?: string;
    priceCents: number;
    currency: string;
    quantityTotal?: number;
    quantitySold?: number;
    minPerOrder?: number;
    maxPerOrder?: number;
    status?: string;
    allowInstallments?: boolean;
    installmentConfig?: {
      mode: "PERCENT_SPLITS";
      splits: Array<{ seq: number; pct: number; dueAfterDays: number }>;
      minDepositPct?: number;
      gracePeriodDays?: number;
      autoCancelOnDefault?: boolean;
    } | null;
  }>;
  createdAt: string;
  updatedAt: string;
  /** When true, event may appear on the homepage featured rail (admin-curated). */
  isFeatured?: boolean;
  /** Lower values sort earlier in the featured rail. */
  featuredSortOrder?: number | null;
}

export interface PublicEventsResponse {
  events: PublicEvent[];
  total: number;
  page: number;
  size: number;
}
