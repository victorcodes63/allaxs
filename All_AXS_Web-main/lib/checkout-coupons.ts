/**
 * Buyer-side coupon preview helper.
 *
 * Calls `/api/checkout/coupons/preview` (proxy → Nest API). Returns
 * the parsed body or throws on network/server error. The endpoint is
 * tolerant of anonymous buyers — if a JWT is present in the cookie
 * jar, the proxy forwards it; otherwise the preview runs without a
 * per-user cap component.
 */

export interface CouponPreviewLine {
  ticketTypeId: string;
  quantity: number;
}

export interface CouponPreviewRequest {
  eventId: string;
  lines: CouponPreviewLine[];
  couponCode: string;
  buyerEmail?: string;
}

export interface CouponPreviewResponse {
  valid: boolean;
  errorCode?: string;
  message?: string;
  code: string;
  subtotalCents: number;
  discountCents: number;
  amountCents: number;
  feesCents: number;
  currency: string;
}

export async function previewCheckoutCoupon(
  request: CouponPreviewRequest,
): Promise<CouponPreviewResponse> {
  const res = await fetch("/api/checkout/coupons/preview", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  type RawPreview = {
    valid?: boolean;
    errorCode?: string;
    message?: string | string[];
    code?: string;
    subtotalCents?: number;
    discountCents?: number;
    amountCents?: number;
    feesCents?: number;
    currency?: string;
  };
  const data = (await res.json().catch(() => ({}))) as RawPreview;

  const flattenMessage = (m: string | string[] | undefined): string | undefined =>
    typeof m === "string"
      ? m
      : Array.isArray(m)
        ? m.join(" • ")
        : undefined;

  if (!res.ok) {
    throw new Error(flattenMessage(data.message) ?? "Unable to preview coupon");
  }

  return {
    valid: !!data.valid,
    errorCode: data.errorCode,
    message: flattenMessage(data.message),
    code: data.code ?? request.couponCode,
    subtotalCents: data.subtotalCents ?? 0,
    discountCents: data.discountCents ?? 0,
    amountCents: data.amountCents ?? 0,
    feesCents: data.feesCents ?? 0,
    currency: data.currency ?? "KES",
  };
}
