export type BuyerOrderListItem = {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
  ticketCount: number;
  paymentReference: string | null;
};

export type PaymentInstallmentStatus =
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type PaymentPlanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";

export type PaymentPlanInstallment = {
  sequence: number;
  amount: number;
  pct: number;
  dueAt: string;
  status: PaymentInstallmentStatus;
  paidAt: string | null;
};

export type BuyerPaymentPlan = {
  status: PaymentPlanStatus;
  totalAmount: number;
  currency: string;
  nextDueAt: string | null;
  installments: PaymentPlanInstallment[];
};

export type BuyerOrderDetail = BuyerOrderListItem & {
  subtotalCents: number;
  discountCents: number;
  feesCents: number;
  organizerNetCents: number;
  buyerName: string;
  buyerEmail: string;
  guestCheckout: boolean;
  coupon: { code: string; discountCents: number } | null;
  lineItems: {
    ticketTypeId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    currency: string;
  }[];
  paymentPlan: BuyerPaymentPlan | null;
};

export type BuyerOrdersListPage = {
  orders: BuyerOrderListItem[];
  total: number;
  limit: number;
  offset: number;
};

export function normalizePaymentPlan(raw: unknown): BuyerPaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const installmentsRaw = p.installments;
  if (!Array.isArray(installmentsRaw)) return null;
  const installments = installmentsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const i = item as Record<string, unknown>;
      const sequence = typeof i.sequence === "number" ? i.sequence : 0;
      if (sequence < 1) return null;
      return {
        sequence,
        amount: typeof i.amount === "number" ? i.amount : 0,
        pct: typeof i.pct === "number" ? i.pct : 0,
        dueAt: typeof i.dueAt === "string" ? i.dueAt : "",
        status:
          typeof i.status === "string"
            ? (i.status as PaymentInstallmentStatus)
            : "PENDING",
        paidAt: typeof i.paidAt === "string" ? i.paidAt : null,
      } satisfies PaymentPlanInstallment;
    })
    .filter((i): i is PaymentPlanInstallment => i !== null)
    .sort((a, b) => a.sequence - b.sequence);
  if (installments.length === 0) return null;
  return {
    status:
      typeof p.status === "string" ? (p.status as PaymentPlanStatus) : "ACTIVE",
    totalAmount: typeof p.totalAmount === "number" ? p.totalAmount : 0,
    currency: typeof p.currency === "string" ? p.currency : "KES",
    nextDueAt: typeof p.nextDueAt === "string" ? p.nextDueAt : null,
    installments,
  };
}

export function normalizeBuyerOrdersListPayload(data: unknown): BuyerOrdersListPage {
  const orders = normalizeBuyerOrdersPayload(data);
  if (!data || typeof data !== "object") {
    return { orders, total: orders.length, limit: orders.length, offset: 0 };
  }
  const d = data as Record<string, unknown>;
  const total = typeof d.total === "number" ? d.total : orders.length;
  const limit = typeof d.limit === "number" ? d.limit : orders.length;
  const offset = typeof d.offset === "number" ? d.offset : 0;
  return { orders, total, limit, offset };
}

export function normalizeBuyerOrdersPayload(data: unknown): BuyerOrderListItem[] {
  if (!data || typeof data !== "object") return [];
  const orders = (data as { orders?: unknown }).orders;
  if (!Array.isArray(orders)) return [];
  return orders
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const o = raw as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      if (!id) return null;
      return {
        id,
        status: typeof o.status === "string" ? o.status : "UNKNOWN",
        totalCents: typeof o.totalCents === "number" ? o.totalCents : 0,
        currency: typeof o.currency === "string" ? o.currency : "KES",
        createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
        eventId: typeof o.eventId === "string" ? o.eventId : "",
        eventTitle: typeof o.eventTitle === "string" ? o.eventTitle : "Event",
        eventSlug: typeof o.eventSlug === "string" ? o.eventSlug : "",
        eventStartAt: typeof o.eventStartAt === "string" ? o.eventStartAt : null,
        eventEndAt: typeof o.eventEndAt === "string" ? o.eventEndAt : null,
        ticketCount: typeof o.ticketCount === "number" ? o.ticketCount : 0,
        paymentReference:
          typeof o.paymentReference === "string" ? o.paymentReference : null,
      } satisfies BuyerOrderListItem;
    })
    .filter((o): o is BuyerOrderListItem => o !== null);
}

export function normalizeBuyerOrderDetail(
  data: unknown,
  fallbackOrderId?: string,
): { order: BuyerOrderDetail | null; paymentPlan: BuyerPaymentPlan | null } {
  if (!data || typeof data !== "object") {
    return { order: null, paymentPlan: null };
  }
  const root = data as Record<string, unknown>;
  const paymentPlan =
    normalizePaymentPlan(root.paymentPlan) ??
    normalizePaymentPlan((root.order as Record<string, unknown> | undefined)?.paymentPlan);
  const raw = root.order;
  if (!raw || typeof raw !== "object") {
    return { order: null, paymentPlan };
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : fallbackOrderId ?? "";
  if (!id) return { order: null, paymentPlan };

  const lineItems = Array.isArray(o.lineItems)
    ? (o.lineItems as BuyerOrderDetail["lineItems"])
    : [];

  const order: BuyerOrderDetail = {
    id,
    status: typeof o.status === "string" ? o.status : "UNKNOWN",
    totalCents: typeof o.totalCents === "number" ? o.totalCents : 0,
    subtotalCents: typeof o.subtotalCents === "number" ? o.subtotalCents : 0,
    discountCents: typeof o.discountCents === "number" ? o.discountCents : 0,
    feesCents: typeof o.feesCents === "number" ? o.feesCents : 0,
    organizerNetCents: typeof o.organizerNetCents === "number" ? o.organizerNetCents : 0,
    currency: typeof o.currency === "string" ? o.currency : "KES",
    createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    eventId: typeof o.eventId === "string" ? o.eventId : "",
    eventTitle: typeof o.eventTitle === "string" ? o.eventTitle : "Event",
    eventSlug: typeof o.eventSlug === "string" ? o.eventSlug : "",
    eventStartAt: typeof o.eventStartAt === "string" ? o.eventStartAt : null,
    eventEndAt: typeof o.eventEndAt === "string" ? o.eventEndAt : null,
    ticketCount: Array.isArray(o.lineItems)
      ? (o.lineItems as { quantity?: number }[]).reduce(
          (acc, li) => acc + (typeof li.quantity === "number" ? li.quantity : 0),
          0,
        )
      : typeof o.ticketCount === "number"
        ? o.ticketCount
        : 0,
    paymentReference:
      typeof o.paymentReference === "string" ? o.paymentReference : null,
    buyerName: typeof o.buyerName === "string" ? o.buyerName : "",
    buyerEmail: typeof o.buyerEmail === "string" ? o.buyerEmail : "",
    guestCheckout: o.guestCheckout === true,
    coupon:
      o.coupon &&
      typeof o.coupon === "object" &&
      typeof (o.coupon as { code?: string }).code === "string"
        ? {
            code: (o.coupon as { code: string }).code,
            discountCents:
              typeof (o.coupon as { discountCents?: number }).discountCents === "number"
                ? (o.coupon as { discountCents: number }).discountCents
                : 0,
          }
        : null,
    lineItems,
    paymentPlan: paymentPlan ?? normalizePaymentPlan(o.paymentPlan),
  };

  return { order, paymentPlan: order.paymentPlan };
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function installmentStatusLabel(status: PaymentInstallmentStatus): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PENDING":
      return "Due";
    case "OVERDUE":
      return "Overdue";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status).replace(/_/g, " ");
  }
}

export function paymentPlanStatusLabel(status: PaymentPlanStatus): string {
  switch (status) {
    case "ACTIVE":
      return "In progress";
    case "COMPLETED":
      return "Paid in full";
    case "DEFAULTED":
      return "Defaulted";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status).replace(/_/g, " ");
  }
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "REFUNDED":
      return "Refunded";
    case "PENDING":
      return "Pending payment";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}
