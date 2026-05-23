/**
 * Shapes from `GET/POST /organizers/payouts/*` (proxied under
 * `/api/organizer/payouts/*`). The web client only needs the data it renders
 * — extra fields from the backend are tolerated by the normalize helpers.
 */
import {
  normalizeCurrencyCode,
  PLATFORM_DEFAULT_CURRENCY,
} from "@/lib/currency";

export type PayoutSummary = {
  availableCents: number;
  pendingCents: number;
  minWithdrawalCents: number;
  currency: string;
  payoutMethod?: string | null;
  payoutDestinationLabel?: string | null;
  /** Whether the organizer has completed banking onboarding sufficient to request payouts. */
  canRequestWithdrawal: boolean;
  /**
   * Optional message describing why the organizer cannot request a withdrawal
   * (e.g. "Add bank details in Account → Payout profile").
   */
  blockedReason?: string | null;
};

export type PayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export type PayoutRequest = {
  id: string;
  amountCents: number;
  currency: string;
  status: PayoutRequestStatus;
  note?: string | null;
  rejectionReason?: string | null;
  externalReference?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  paidAt?: string | null;
};

export type PayoutRequestsListPayload = {
  requests: PayoutRequest[];
  total: number;
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

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizePayoutSummary(data: unknown): PayoutSummary | null {
  if (!isRecord(data)) return null;

  const pendingRequest = isRecord(data.pendingRequest)
    ? normalizePayoutRequest(data.pendingRequest)
    : null;

  const canRequest =
    typeof data.canRequest === "boolean"
      ? data.canRequest
      : data.canRequestWithdrawal !== false;

  const violations = Array.isArray(data.profileViolations)
    ? data.profileViolations.filter((v): v is string => typeof v === "string")
    : [];

  let blockedReason: string | null =
    typeof data.blockedReason === "string" ? data.blockedReason : null;
  if (!canRequest && !blockedReason) {
    if (violations.length > 0) {
      blockedReason = violations.join(" ");
    } else if (data.readyForSettlement === false) {
      blockedReason =
        "Complete your payout profile in Account and wait for admin verification before withdrawing.";
    } else if (pendingRequest) {
      blockedReason =
        "You already have a pending withdrawal request. Cancel it to submit another.";
    }
  }

  return {
    availableCents: num(data.availableCents),
    pendingCents:
      num(data.pendingCents) ||
      (pendingRequest?.status === "PENDING" ? pendingRequest.amountCents : 0),
    minWithdrawalCents: num(data.minWithdrawalCents, 0),
    currency: normalizeCurrencyCode(
      typeof data.currency === "string" ? data.currency : undefined,
    ),
    payoutMethod: typeof data.payoutMethod === "string" ? data.payoutMethod : null,
    payoutDestinationLabel:
      typeof data.payoutDestinationLabel === "string"
        ? data.payoutDestinationLabel
        : null,
    canRequestWithdrawal: canRequest,
    blockedReason,
  };
}

const STATUS_VALUES: PayoutRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "REJECTED",
  "CANCELLED",
];

function normalizeStatus(value: unknown): PayoutRequestStatus {
  if (
    typeof value === "string" &&
    (STATUS_VALUES as string[]).includes(value)
  ) {
    return value as PayoutRequestStatus;
  }
  return "PENDING";
}

export function normalizePayoutRequest(data: unknown): PayoutRequest | null {
  if (!isRecord(data)) return null;
  const id = str(data.id);
  if (!id) return null;
  return {
    id,
    amountCents: num(data.amountCents),
    currency: normalizeCurrencyCode(
      typeof data.currency === "string" ? data.currency : undefined,
    ),
    status: normalizeStatus(data.status),
    note: typeof data.note === "string" ? data.note : null,
    rejectionReason:
      typeof data.rejectionReason === "string" ? data.rejectionReason : null,
    externalReference:
      typeof data.externalReference === "string" ? data.externalReference : null,
    createdAt: str(data.createdAt),
    updatedAt: str(data.updatedAt, str(data.createdAt)),
    approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : null,
    paidAt: typeof data.paidAt === "string" ? data.paidAt : null,
  };
}

export function normalizePayoutRequests(
  data: unknown,
): PayoutRequestsListPayload {
  if (Array.isArray(data)) {
    const requests = data
      .map(normalizePayoutRequest)
      .filter((r): r is PayoutRequest => r !== null);
    return { requests, total: requests.length };
  }
  if (isRecord(data) && Array.isArray(data.requests)) {
    const requests = data.requests
      .map(normalizePayoutRequest)
      .filter((r): r is PayoutRequest => r !== null);
    return { requests, total: num(data.total, requests.length) };
  }
  return { requests: [], total: 0 };
}

export function payoutStatusLabel(status: PayoutRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "PROCESSING":
      return "Processing";
    case "PAID":
      return "Paid";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function payoutStatusChipClass(status: PayoutRequestStatus): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    case "APPROVED":
    case "PROCESSING":
      return "bg-sky-500/10 text-sky-300 border-sky-500/30";
    case "REJECTED":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    case "CANCELLED":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    case "PENDING":
    default:
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  }
}

export const PAYOUT_DEFAULT_CURRENCY = PLATFORM_DEFAULT_CURRENCY;
