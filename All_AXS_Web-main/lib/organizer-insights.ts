/** Shapes for `GET /organizers/analytics/insights` (proxied as `/api/organizer/analytics/insights`). */
import {
  normalizeCurrencyCode,
  PLATFORM_DEFAULT_CURRENCY,
} from "@/lib/currency";

export type InsightTierRow = {
  tierId: string;
  name: string;
  ticketsSold: number;
  capacity: number;
  grossCents: number;
  netCents: number;
  currency: string;
};

export type InsightTrafficSourceRow = {
  source: string;
  visits: number;
  conversions: number;
  revenueCents: number;
};

export type InsightTimePoint = {
  date: string;
  ticketsSold: number;
  grossCents: number;
};

export type EventInsightsPayload = {
  rangeStart: string | null;
  rangeEnd: string | null;
  scanned: number;
  totalIssued: number;
  scanRate: number;
  totalRevenueCents: number;
  totalNetCents: number;
  currency: string;
  tiers: InsightTierRow[];
  trafficSources: InsightTrafficSourceRow[];
  timeline: InsightTimePoint[];
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

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function normalizeEventInsights(
  data: unknown,
): EventInsightsPayload | null {
  if (!isRecord(data)) return null;

  const tiersRaw = Array.isArray(data.tiers) ? data.tiers : [];
  const tiers: InsightTierRow[] = [];
  for (const row of tiersRaw) {
    if (!isRecord(row)) continue;
    const tierId = str(row.tierId, str(row.id));
    if (!tierId) continue;
    tiers.push({
      tierId,
      name: str(row.name, "Tier"),
      ticketsSold: num(row.ticketsSold),
      capacity: num(row.capacity),
      grossCents: num(row.grossCents),
      netCents: num(row.netCents, num(row.grossCents)),
      currency: normalizeCurrencyCode(str(row.currency) || undefined),
    });
  }

  const sourcesRaw = Array.isArray(data.trafficSources)
    ? data.trafficSources
    : [];
  const trafficSources: InsightTrafficSourceRow[] = [];
  for (const row of sourcesRaw) {
    if (!isRecord(row)) continue;
    trafficSources.push({
      source: str(row.source, "direct"),
      visits: num(row.visits),
      conversions: num(row.conversions),
      revenueCents: num(row.revenueCents),
    });
  }

  const timelineRaw = Array.isArray(data.timeline) ? data.timeline : [];
  const timeline: InsightTimePoint[] = [];
  for (const row of timelineRaw) {
    if (!isRecord(row)) continue;
    timeline.push({
      date: str(row.date),
      ticketsSold: num(row.ticketsSold),
      grossCents: num(row.grossCents),
    });
  }

  const totalIssued = num(data.totalIssued);
  const scanned = num(data.scanned);
  const scanRate = num(
    data.scanRate,
    totalIssued > 0 ? scanned / totalIssued : 0,
  );

  return {
    rangeStart: strOrNull(data.rangeStart),
    rangeEnd: strOrNull(data.rangeEnd),
    scanned,
    totalIssued,
    scanRate,
    totalRevenueCents: num(data.totalRevenueCents),
    totalNetCents: num(data.totalNetCents, num(data.totalRevenueCents)),
    currency: normalizeCurrencyCode(str(data.currency) || PLATFORM_DEFAULT_CURRENCY),
    tiers,
    trafficSources,
    timeline,
  };
}
