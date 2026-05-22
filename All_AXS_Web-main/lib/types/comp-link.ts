export interface CompLinkPreview {
  event: {
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
  };
  tier: {
    id: string;
    name: string;
    description?: string;
    priceCents: number;
    currency: string;
    quantityTotal?: number;
    quantitySold?: number;
    minPerOrder?: number;
    maxPerOrder?: number;
  };
  quantity: number;
}
