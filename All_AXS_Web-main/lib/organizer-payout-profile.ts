/**
 * `payoutProfile` object returned on `GET/POST /organizers/profile` (proxied as `/api/organizer/profile`).
 */
export type OrganizerPayoutProfileStatus = {
  isComplete: boolean;
  missingItems: string[];
  adminVerified: boolean;
  readyForSettlement: boolean;
};

export function extractPayoutProfileStatus(
  data: unknown,
): OrganizerPayoutProfileStatus | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const pp = o.payoutProfile;
  if (!pp || typeof pp !== "object") return null;
  const p = pp as Record<string, unknown>;
  return {
    isComplete: p.isComplete === true,
    missingItems: Array.isArray(p.missingItems)
      ? (p.missingItems as unknown[]).map((x) => String(x))
      : [],
    adminVerified: p.adminVerified === true,
    readyForSettlement: p.readyForSettlement === true,
  };
}
