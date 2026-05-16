/** Shapes from `GET /organizers/earnings/*` (proxied under `/api/organizer/earnings/*`). */

export type OrganizerEarningsSummary = {
  organizerId: string;
  orgName: string;
  currency: string;
  ledgerNetCents: number;
  reservedInOpenBatchesCents: number;
  availableCents: number;
};

export type OrganizerLedgerEntryRow = {
  id: string;
  createdAt: string;
  entryType: string;
  entryTypeLabel: string;
  amountCents: number;
  currency: string;
  orderId: string | null;
  metadata: Record<string, unknown> | null;
};

export type OrganizerEarningsLedgerPayload = {
  organizerId: string;
  total: number;
  entries: OrganizerLedgerEntryRow[];
};

export type PayoutBatchLineRow = {
  id: string;
  organizerId: string;
  orgName: string | null;
  amountCents: number;
  currency: string;
};

export type PayoutBatchRow = {
  id: string;
  status: string;
  currency: string;
  notes: string | null;
  externalReference: string | null;
  createdByUserId: string | null;
  approvedAt: string | null;
  markedPaidAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalCents: number;
  lines: PayoutBatchLineRow[];
};

export type AdminPayoutBatchesListPayload = {
  total: number;
  batches: PayoutBatchRow[];
};
