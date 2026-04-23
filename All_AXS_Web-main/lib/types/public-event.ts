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
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicEventsResponse {
  events: PublicEvent[];
  total: number;
  page: number;
  size: number;
}
