/**
 * Typed client helpers for the per-event coupons API.
 *
 * Backend routes (see `All_AXS_Backend-main/src/events/coupons.controller.ts`):
 *   - GET    /events/:eventId/coupons
 *   - POST   /events/:eventId/coupons
 *   - GET    /coupons/:id
 *   - PATCH  /coupons/:id
 *   - DELETE /coupons/:id
 *
 * Auth + token refresh is handled by `apiClient`. See COUPONS_SPEC §5.
 */

import { apiClient } from "@/lib/api-client";

export type CouponKind = "FIXED" | "PERCENT";

export interface Coupon {
  id: string;
  eventId: string;
  code: string;
  kind: CouponKind;
  valueCents?: number;
  percentOff?: number;
  startAt?: string;
  endAt?: string;
  usageLimit?: number;
  usedCount: number;
  perUserLimit?: number;
  minOrderCents?: number;
  currency?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponPayload {
  code: string;
  kind: CouponKind;
  valueCents?: number;
  percentOff?: number;
  startAt?: string;
  endAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  minOrderCents?: number;
  currency?: string;
  active?: boolean;
}

export type UpdateCouponPayload = Partial<CreateCouponPayload>;

export async function listCoupons(eventId: string): Promise<Coupon[]> {
  const res = await apiClient.get<Coupon[]>(
    `/events/${encodeURIComponent(eventId)}/coupons`,
  );
  return res.data;
}

export async function createCoupon(
  eventId: string,
  payload: CreateCouponPayload,
): Promise<Coupon> {
  const res = await apiClient.post<Coupon>(
    `/events/${encodeURIComponent(eventId)}/coupons`,
    payload,
  );
  return res.data;
}

export async function getCoupon(id: string): Promise<Coupon> {
  const res = await apiClient.get<Coupon>(
    `/coupons/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  const res = await apiClient.patch<Coupon>(
    `/coupons/${encodeURIComponent(id)}`,
    payload,
  );
  return res.data;
}

export interface DeleteCouponResult {
  deleted: boolean;
  disabled: boolean;
  couponId: string;
}

export async function deleteCoupon(id: string): Promise<DeleteCouponResult> {
  const res = await apiClient.delete<DeleteCouponResult>(
    `/coupons/${encodeURIComponent(id)}`,
  );
  return res.data;
}

/**
 * Coupons lifecycle pill: derived from {active, startAt, endAt, usageLimit, usedCount}.
 * Computed on the client so the row stays responsive after edits.
 */
export type CouponLifecycle =
  | "ACTIVE"
  | "INACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "EXHAUSTED";

export function deriveCouponLifecycle(c: Coupon, now: Date = new Date()): CouponLifecycle {
  if (!c.active) return "INACTIVE";
  if (c.endAt && new Date(c.endAt).getTime() <= now.getTime()) return "EXPIRED";
  if (c.startAt && new Date(c.startAt).getTime() > now.getTime()) return "SCHEDULED";
  if (typeof c.usageLimit === "number" && c.usedCount >= c.usageLimit) {
    return "EXHAUSTED";
  }
  return "ACTIVE";
}

export function formatCouponValue(c: Coupon): string {
  if (c.kind === "PERCENT") {
    return `${c.percentOff ?? 0}% off`;
  }
  const cents = c.valueCents ?? 0;
  const currency = c.currency ?? "KES";
  try {
    return `${new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "KES",
      maximumFractionDigits: 0,
    }).format(cents / 100)} off`;
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency} off`;
  }
}
