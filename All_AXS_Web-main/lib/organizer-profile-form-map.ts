import { normalizeOrganizerProfilePayload } from "@/lib/organizer-profile-display";
import type { OrganizerOnboardingInput } from "@/lib/validation/organizer";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const PAYOUT_METHODS = ["BANK_ACCOUNT", "MPESA", "OTHER"] as const;

/**
 * Maps `GET /api/organizer/profile` JSON into values for the organizer onboarding schema
 * (create/update payload shape for `POST /api/organizer/profile`).
 */
export function organizerProfileApiToFormValues(
  data: unknown,
): OrganizerOnboardingInput | null {
  const display = normalizeOrganizerProfilePayload(data);
  if (!display) return null;

  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawPm = str(o.payoutMethod) || str(o.payout_method) || "BANK_ACCOUNT";
  const payoutMethod = PAYOUT_METHODS.includes(rawPm as (typeof PAYOUT_METHODS)[number])
    ? (rawPm as OrganizerOnboardingInput["payoutMethod"])
    : "BANK_ACCOUNT";

  const fromDetails =
    o.payoutDetails &&
    typeof o.payoutDetails === "object" &&
    o.payoutDetails !== null &&
    "instructions" in o.payoutDetails
      ? str((o.payoutDetails as { instructions?: unknown }).instructions as string)
      : undefined;

  return {
    orgName: display.orgName,
    legalName: (display.legalName?.trim() || display.orgName || "").trim(),
    website: display.website || "",
    supportEmail: display.supportEmail,
    supportPhone: display.supportPhone || "",
    payoutMethod,
    bankName: str(o.bankName) || str(o.bank_name) || undefined,
    bankAccountName: str(o.bankAccountName) || str(o.bank_account_name) || undefined,
    bankAccountNumber: str(o.bankAccountNumber) || str(o.bank_account_number) || undefined,
    mpesaPaybill: str(o.mpesaPaybill) || str(o.mpesa_paybill) || undefined,
    mpesaTillNumber: str(o.mpesaTillNumber) || str(o.mpesa_till_number) || undefined,
    payoutInstructions:
      str(o.payoutInstructions) || str(o.payout_instructions) || fromDetails || undefined,
    taxId: (display.taxId || str(o.taxId) || str(o.tax_id) || "").trim(),
  };
}
