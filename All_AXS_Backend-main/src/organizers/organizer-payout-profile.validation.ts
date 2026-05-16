import { PayoutMethod } from '../domain/enums';

/** Shape used for professional payout checks (DTO and/or persisted entity). */
export type OrganizerPayoutProfileFields = {
  orgName?: string;
  legalName?: string | null;
  supportEmail?: string;
  supportPhone?: string | null;
  payoutMethod?: PayoutMethod | string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  mpesaPaybill?: string | null;
  mpesaTillNumber?: string | null;
  payoutInstructions?: string | null;
  taxId?: string | null;
};

function trim(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function digitCount(v: string | null | undefined): number {
  return (v ?? '').replace(/\D/g, '').length;
}

/**
 * Returns human-readable gaps for finance-grade payout profiles.
 * Empty array means structurally complete (admin verification is separate).
 */
export function getProfessionalPayoutProfileViolations(
  p: OrganizerPayoutProfileFields,
): string[] {
  const out: string[] = [];
  const orgName = trim(p.orgName);
  if (orgName.length < 2) {
    out.push('Organization name is required (at least 2 characters).');
  }
  const supportEmail = trim(p.supportEmail);
  if (!supportEmail) {
    out.push('Support email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    out.push('Support email must be a valid address.');
  }
  const legal = trim(p.legalName);
  if (legal.length < 2) {
    out.push('Legal name is required (as shown on contracts and bank records).');
  }
  const tax = trim(p.taxId);
  if (tax.length < 3) {
    out.push('Tax or business ID is required (e.g. PIN, VAT, company number).');
  }
  const phone = trim(p.supportPhone);
  if (phone.length < 8) {
    out.push('Support phone is required (at least 8 characters, include country code).');
  } else if (digitCount(phone) < 8) {
    out.push('Support phone must include at least 8 digits (country code + number).');
  }

  const pmRaw = trim(p.payoutMethod as string | undefined);
  if (!pmRaw || !Object.values(PayoutMethod).includes(pmRaw as PayoutMethod)) {
    out.push('Select a payout method.');
  } else {
    const pm = pmRaw as PayoutMethod;
    if (pm === PayoutMethod.BANK_ACCOUNT) {
      if (!trim(p.bankName)) out.push('Bank name is required.');
      if (!trim(p.bankAccountName)) out.push('Bank account name is required.');
      if (!trim(p.bankAccountNumber)) out.push('Bank account number is required.');
    } else if (pm === PayoutMethod.MPESA) {
      const pb = trim(p.mpesaPaybill);
      const till = trim(p.mpesaTillNumber);
      if (!pb && !till) {
        out.push('Provide at least an M-Pesa paybill or till number.');
      }
    } else if (pm === PayoutMethod.OTHER) {
      const instr = trim(p.payoutInstructions);
      if (instr.length < 24) {
        out.push(
          'Payout instructions must be at least 24 characters when using “Other”.',
        );
      }
    }
  }

  return out;
}

export function isProfessionallyCompletePayoutProfile(
  p: OrganizerPayoutProfileFields,
): boolean {
  return getProfessionalPayoutProfileViolations(p).length === 0;
}
