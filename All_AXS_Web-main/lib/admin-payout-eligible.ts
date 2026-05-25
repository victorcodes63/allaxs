import { normalizeCurrencyCode } from "@/lib/currency";

export type EligiblePayoutOrganizer = {
  id: string;
  orgName: string;
  supportEmail: string;
  userEmail: string | null;
  payoutMethod: string | null;
  verified: boolean;
  availableCents: number;
  reservedInOpenBatchesCents: number;
  ledgerNetCents: number;
  currency: string;
};

export type EligiblePayoutOrganizersPayload = {
  organizers: EligiblePayoutOrganizer[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function normalizeEligiblePayoutOrganizers(
  data: unknown,
): EligiblePayoutOrganizer[] {
  if (!isRecord(data) || !Array.isArray(data.organizers)) return [];
  const out: EligiblePayoutOrganizer[] = [];
  for (const raw of data.organizers) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;
    out.push({
      id,
      orgName: typeof raw.orgName === "string" ? raw.orgName : "Organizer",
      supportEmail:
        typeof raw.supportEmail === "string" ? raw.supportEmail : "",
      userEmail: typeof raw.userEmail === "string" ? raw.userEmail : null,
      payoutMethod:
        typeof raw.payoutMethod === "string" ? raw.payoutMethod : null,
      verified: raw.verified === true,
      availableCents: num(raw.availableCents),
      reservedInOpenBatchesCents: num(raw.reservedInOpenBatchesCents),
      ledgerNetCents: num(raw.ledgerNetCents),
      currency: normalizeCurrencyCode(
        typeof raw.currency === "string" ? raw.currency : undefined,
      ),
    });
  }
  return out;
}
