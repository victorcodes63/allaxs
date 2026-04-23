/** Fields we read from GET /api/organizer/profile (camelCase or snake_case). */
export type OrganizerProfileDisplay = {
  orgName: string;
  legalName?: string;
  supportEmail: string;
  supportPhone?: string;
  website?: string;
  payoutMethod?: string;
  taxId?: string;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export function payoutMethodLabel(method: string | undefined): string {
  switch (method) {
    case "BANK_ACCOUNT":
      return "Bank transfer";
    case "MPESA":
      return "M-Pesa";
    case "OTHER":
      return "Other";
    default:
      return method ? method.replace(/_/g, " ").toLowerCase() : "—";
  }
}

/**
 * Normalizes organizer profile JSON for dashboard display.
 */
export function normalizeOrganizerProfilePayload(data: unknown): OrganizerProfileDisplay | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const orgName =
    str(o.orgName) ??
    str(o.org_name) ??
    str(o.organizationName) ??
    str(o.organization_name);
  const supportEmail =
    str(o.supportEmail) ?? str(o.support_email) ?? str(o.email);

  if (!orgName || !supportEmail) return null;

  return {
    orgName,
    legalName: str(o.legalName) ?? str(o.legal_name),
    supportEmail,
    supportPhone: str(o.supportPhone) ?? str(o.support_phone),
    website: str(o.website) ?? str(o.web_site),
    payoutMethod: str(o.payoutMethod) ?? str(o.payout_method),
    taxId: str(o.taxId) ?? str(o.tax_id),
  };
}
