/** Shapes returned by `GET /organizers/analytics/summary` (proxied as `/api/organizer/analytics/summary`). */

import type { OrderTrendPoint } from "@/components/charts/Sparkline";
import { normalizeCurrencyCode } from "@/lib/currency";

export type OrganizerAnalyticsSummary = {
  generatedAt: string;
  eventId: string | null;
  currency: string;
  paid: {
    count: number;
    grossCents: number;
  };
  refunded: {
    count: number;
    grossCents: number;
    rate: number;
  };
  conversionRate: number;
  dailySales: OrderTrendPoint[];
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

function normalizeDailySales(data: unknown): OrderTrendPoint[] {
  if (!Array.isArray(data)) return [];
  const points: OrderTrendPoint[] = [];
  for (const row of data) {
    if (!isRecord(row)) continue;
    const date = str(row.date);
    if (!date) continue;
    points.push({
      date,
      count: num(row.count),
      grossCents: num(row.grossCents),
    });
  }
  return points;
}

export function normalizeOrganizerAnalyticsSummary(
  data: unknown,
): OrganizerAnalyticsSummary | null {
  if (!isRecord(data)) return null;
  const paidRaw = data.paid;
  const refundedRaw = data.refunded;
  if (!isRecord(paidRaw) || !isRecord(refundedRaw)) return null;

  return {
    generatedAt: str(data.generatedAt),
    eventId: data.eventId === null ? null : str(data.eventId) || null,
    currency: normalizeCurrencyCode(str(data.currency) || undefined),
    paid: {
      count: num(paidRaw.count),
      grossCents: num(paidRaw.grossCents),
    },
    refunded: {
      count: num(refundedRaw.count),
      grossCents: num(refundedRaw.grossCents),
      rate: num(refundedRaw.rate),
    },
    conversionRate: num(data.conversionRate),
    dailySales: normalizeDailySales(data.dailySales),
  };
}

export function formatPercent(rate: number): string {
  const pct = rate * 100;
  if (!Number.isFinite(pct)) return "0%";
  return `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`;
}
