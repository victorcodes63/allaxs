import { EventStatus } from "@/lib/validation/event";

const ORDER_STATUSES = [
  "DRAFT",
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
] as const;

const TREND_DAYS = 14;

/** 401 = JWT rejected but route exists; 200 = ok. 404 = handler missing on this deploy. */
function routeLikelyExists(status: number): boolean {
  return status === 200 || status === 401;
}

function utcDayKeys(): string[] {
  const trendStart = new Date();
  trendStart.setUTCHours(0, 0, 0, 0);
  trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));
  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const d = new Date(trendStart);
    d.setUTCDate(trendStart.getUTCDate() + index);
    return d.toISOString().slice(0, 10);
  });
}

function emptySubmissionTrend(): Array<{ date: string; count: number }> {
  return utcDayKeys().map((date) => ({ date, count: 0 }));
}

function emptyOrderTrend(): Array<{
  date: string;
  count: number;
  grossCents: number;
}> {
  return utcDayKeys().map((date) => ({ date, count: 0, grossCents: 0 }));
}

function emptyOrderCounts(): Record<string, number> {
  return ORDER_STATUSES.reduce(
    (acc, s) => {
      acc[s] = 0;
      return acc;
    },
    {} as Record<string, number>,
  );
}

async function adminGetJson(
  apiUrl: string,
  path: string,
  accessToken: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { ok: response.ok, status: response.status, data };
}

async function sumOrdersForStatus(
  apiUrl: string,
  accessToken: string,
  status: string,
  includeFees: boolean,
): Promise<{ count: number; grossCents: number; feesCents: number }> {
  let offset = 0;
  const limit = 100;
  let grossCents = 0;
  let feesCents = 0;
  let count = 0;
  while (true) {
    const path = `/admin/orders?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`;
    const { ok, status: http, data } = await adminGetJson(apiUrl, path, accessToken);
    if (!ok || http !== 200) {
      return { count, grossCents, feesCents };
    }
    const body = data as {
      items?: Array<{ amountCents?: number; feesCents?: number }>;
      total?: number;
    };
    const items = Array.isArray(body.items) ? body.items : [];
    const total = typeof body.total === "number" ? body.total : items.length;
    for (const row of items) {
      count += 1;
      grossCents += Number(row.amountCents ?? 0);
      if (includeFees) feesCents += Number(row.feesCents ?? 0);
    }
    if (items.length < limit || offset + items.length >= total) break;
    offset += limit;
  }
  return { count, grossCents, feesCents };
}

/**
 * When `GET /admin/overview` is missing on the deployed Nest bundle, rebuild a
 * compatible snapshot from other admin routes. Older bundles may omit
 * `/admin/orders` or `/admin/users` — those sections degrade to zeros instead
 * of failing the whole dashboard.
 */
export async function buildAdminOverviewFallback(
  apiUrl: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const eventStatuses = Object.values(EventStatus);

  const [ordersProbe, usersProbe] = await Promise.all([
    adminGetJson(apiUrl, "/admin/orders?limit=1&offset=0", accessToken),
    adminGetJson(apiUrl, "/admin/users?limit=1&offset=0", accessToken),
  ]);

  const ordersUsable = routeLikelyExists(ordersProbe.status);
  const usersUsable = routeLikelyExists(usersProbe.status);

  const [orderCountPairs, roleTotals, paidAgg, refundedAgg, eventListsByStatus, totalUsersRow] =
    await Promise.all([
      ordersUsable
        ? Promise.all(
            ORDER_STATUSES.map(async (status) => {
              const { ok, status: http, data } = await adminGetJson(
                apiUrl,
                `/admin/orders?status=${encodeURIComponent(status)}&limit=1&offset=0`,
                accessToken,
              );
              if (!ok || http !== 200) {
                return [status, 0] as const;
              }
              const total = (data as { total?: number }).total;
              return [status, typeof total === "number" ? total : 0] as const;
            }),
          )
        : Promise.resolve(
            ORDER_STATUSES.map((s) => [s, 0] as const),
          ),
      usersUsable
        ? Promise.all(
            (["ADMIN", "ORGANIZER", "ATTENDEE"] as const).map(async (role) => {
              const { ok, status: http, data } = await adminGetJson(
                apiUrl,
                `/admin/users?role=${encodeURIComponent(role)}&limit=1&offset=0`,
                accessToken,
              );
              if (!ok || http !== 200) {
                return [role, 0] as const;
              }
              const total = (data as { total?: number }).total;
              return [role, typeof total === "number" ? total : 0] as const;
            }),
          )
        : Promise.resolve(
            (["ADMIN", "ORGANIZER", "ATTENDEE"] as const).map(
              (r) => [r, 0] as const,
            ),
          ),
      ordersUsable
        ? sumOrdersForStatus(apiUrl, accessToken, "PAID", true)
        : Promise.resolve({ count: 0, grossCents: 0, feesCents: 0 }),
      ordersUsable
        ? sumOrdersForStatus(apiUrl, accessToken, "REFUNDED", false)
        : Promise.resolve({ count: 0, grossCents: 0, feesCents: 0 }),
      Promise.all(
        eventStatuses.map(async (status) => {
          const { ok, status: http, data } = await adminGetJson(
            apiUrl,
            `/admin/events?status=${encodeURIComponent(status)}`,
            accessToken,
          );
          if (!ok || http !== 200 || !Array.isArray(data)) {
            return [];
          }
          return data;
        }),
      ),
      usersUsable
        ? adminGetJson(apiUrl, `/admin/users?limit=1&offset=0`, accessToken)
        : Promise.resolve({ ok: false, status: 404, data: {} }),
    ]);

  let totalUsersN = 0;
  if (usersUsable && totalUsersRow.ok && totalUsersRow.status === 200) {
    const totalUsers = (totalUsersRow.data as { total?: number }).total;
    totalUsersN = typeof totalUsers === "number" ? totalUsers : 0;
  }

  const orderCounts = emptyOrderCounts();
  for (const [status, n] of orderCountPairs) {
    orderCounts[status] = n;
  }

  const roleMap = Object.fromEntries(roleTotals) as Record<
    "ADMIN" | "ORGANIZER" | "ATTENDEE",
    number
  >;

  const eventCounts = eventStatuses.reduce(
    (acc, status, i) => {
      const list = eventListsByStatus[i] as unknown[];
      acc[status] = list.length;
      return acc;
    },
    {} as Record<EventStatus, number>,
  );

  type Ev = {
    id: string;
    title: string;
    slug?: string | null;
    startAt: string;
    endAt: string;
    submittedAt?: string | null;
    createdAt: string;
    bannerUrl?: string | null;
    organizer?: {
      id?: string;
      orgName?: string;
      user?: { email?: string | null; name?: string | null };
    };
  };

  const pendingList = (eventListsByStatus[
    eventStatuses.indexOf(EventStatus.PENDING_REVIEW)
  ] ?? []) as Ev[];

  pendingList.sort(
    (a, b) =>
      new Date(a.submittedAt ?? a.createdAt).getTime() -
      new Date(b.submittedAt ?? b.createdAt).getTime(),
  );

  const pendingReviewQueue = pendingList.slice(0, 5).map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug ?? null,
    startAt: event.startAt,
    endAt: event.endAt,
    submittedAt: event.submittedAt ?? event.createdAt,
    bannerUrl: event.bannerUrl ?? null,
    organizer: {
      id: event.organizer?.id,
      orgName: event.organizer?.orgName ?? "Unknown organizer",
      email: event.organizer?.user?.email ?? null,
      name: event.organizer?.user?.name ?? null,
    },
  }));

  return {
    generatedAt: new Date().toISOString(),
    events: {
      byStatus: eventCounts,
      submissionTrend: emptySubmissionTrend(),
      pendingReviewQueue,
    },
    orders: {
      byStatus: orderCounts,
      paid: {
        count: paidAgg.count,
        grossCents: paidAgg.grossCents,
        feesCents: paidAgg.feesCents,
        netCents: Math.max(0, paidAgg.grossCents - paidAgg.feesCents),
      },
      refunded: {
        count: refundedAgg.count,
        grossCents: refundedAgg.grossCents,
      },
      paidTrend: emptyOrderTrend(),
      refundedTrend: emptyOrderTrend(),
    },
    users: {
      total: totalUsersN,
      admins: roleMap.ADMIN ?? 0,
      organizers: roleMap.ORGANIZER ?? 0,
      attendees: roleMap.ATTENDEE ?? 0,
    },
    recentActivity: [],
  };
}
