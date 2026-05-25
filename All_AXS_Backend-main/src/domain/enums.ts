export enum Role {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  ATTENDEE = 'ATTENDEE',
}
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  /** Self-service closed account; credentials and PII are scrubbed. */
  CLOSED = 'CLOSED',
}

export enum EventType {
  IN_PERSON = 'IN_PERSON',
  VIRTUAL = 'VIRTUAL',
  HYBRID = 'HYBRID',
}
export enum EventStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum CouponType {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  // PARTIALLY_PAID is not used - payment progress is derived from PaymentPlan/Installments
  // Keeping for backward compatibility but should not be written to DB
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentGateway {
  PAYSTACK = 'PAYSTACK',
}
export enum PaymentStatus {
  INITIATED = 'INITIATED',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum TicketStatus {
  ISSUED = 'ISSUED',
  VOID = 'VOID',
  CHECKED_IN = 'CHECKED_IN',
}

export enum NotifyChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
}
export enum NotifyStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum PayoutMethod {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  MPESA = 'MPESA',
  OTHER = 'OTHER',
}

export enum TicketTypeStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  SOLD_OUT = 'SOLD_OUT',
}

export enum WaitlistStatus {
  WAITING = 'WAITING',
  NOTIFIED = 'NOTIFIED',
  PURCHASED = 'PURCHASED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/** Organizer ledger / settlement (signed amount_cents: positive = owed to organizer). */
export enum LedgerEntryType {
  ORDER_EARNINGS = 'ORDER_EARNINGS',
  ORDER_REFUND_REVERSAL = 'ORDER_REFUND_REVERSAL',
  PAYOUT = 'PAYOUT',
}

export enum PayoutBatchStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  EXPORTED = 'EXPORTED',
  MARKED_PAID = 'MARKED_PAID',
  CANCELLED = 'CANCELLED',
}

export enum RefundRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

/**
 * Lifecycle for self-serve organizer withdrawals.
 * PENDING  -> organizer just submitted the request, awaiting admin review
 * APPROVED -> admin approved; ready to be rolled into a payout batch
 * PAID     -> a payout batch covering the request has been MARKED_PAID
 * REJECTED -> admin rejected with an explanatory note
 * CANCELLED -> organizer cancelled their own PENDING request
 */
export enum PayoutWithdrawRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
