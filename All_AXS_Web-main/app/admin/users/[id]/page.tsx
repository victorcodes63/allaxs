"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { userInitials } from "@/lib/hub-user";
import { useAuth } from "@/lib/auth";
import { formatMoneyFromCents } from "@/lib/organizer-sales";
import {
  ManageUserRolesDialog,
  type AdminRole,
  type ManageRolesTarget,
} from "@/components/admin/ManageUserRolesDialog";
import {
  UserActionConfirmDialog,
  type UserActionKind,
  type UserActionTarget,
} from "@/components/admin/UserActionConfirmDialog";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

type UserStatus = "ACTIVE" | "SUSPENDED";

interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    roles: AdminRole[];
    status: UserStatus;
    createdAt: string;
    updatedAt: string;
  };
  organizerProfile: {
    id: string;
    orgName: string;
    legalName: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    website: string | null;
    verified: boolean;
    createdAt: string;
  } | null;
  hostedEvents: {
    byStatus: Record<string, number>;
    items: Array<{
      id: string;
      title: string;
      slug: string | null;
      status: string;
      type: string;
      startAt: string;
      endAt: string;
      bannerUrl: string | null;
      venue: string | null;
      city: string | null;
      country: string | null;
      ticketTypeCount: number;
      createdAt: string;
    }>;
  };
  orders: {
    byStatus: Record<string, number>;
    total: number;
    grossCents: number;
    feesCents: number;
    netCents: number;
    items: Array<{
      id: string;
      reference: string | null;
      status: string;
      amountCents: number;
      feesCents: number;
      currency: string;
      email: string;
      phone: string | null;
      itemCount: number;
      createdAt: string;
      event: {
        id: string;
        title: string;
        slug: string | null;
        organizer: { id: string; orgName: string } | null;
      } | null;
    }>;
  };
  audit: AuditEntry[];
}

interface AuditEntry {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  admin: { id: string; email: string; name?: string | null } | null;
}

function roleChipClass(role: AdminRole): string {
  switch (role) {
    case "ADMIN":
      return "border-amber-400/35 bg-amber-500/15 text-amber-100";
    case "ORGANIZER":
      return "border-sky-400/30 bg-sky-500/12 text-sky-100";
    case "ATTENDEE":
    default:
      return "border-white/10 bg-white/[0.06] text-foreground/85";
  }
}

function statusChipClass(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "PUBLISHED":
      return "border-emerald-400/25 bg-emerald-500/12 text-emerald-100";
    case "SUSPENDED":
    case "FAILED":
    case "CANCELLED":
    case "REJECTED":
      return "border-red-400/30 bg-red-500/12 text-red-100";
    case "PENDING":
    case "PARTIALLY_PAID":
    case "PENDING_REVIEW":
      return "border-sky-400/25 bg-sky-500/15 text-sky-100";
    case "REFUNDED":
      return "border-amber-400/25 bg-amber-500/15 text-amber-100";
    default:
      return "border-white/10 bg-white/[0.06] text-foreground/80";
  }
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function labelFromEnum(value: string): string {
  return value.replace(/_/g, " ").toLowerCase();
}

function countFromRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, count) => sum + Number(count), 0);
}

function pickString(
  obj: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!obj) return null;
  const value = obj[key];
  return typeof value === "string" ? value : null;
}

function pickStringArray(
  obj: Record<string, unknown> | null | undefined,
  key: string,
): string[] | null {
  if (!obj) return null;
  const value = obj[key];
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === "string");
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    UPDATE_USER_ROLES: "Updated roles",
    UPDATE_USER_STATUS: "Updated status",
    FORCE_USER_LOGOUT: "Forced sign-out",
  };
  if (map[action]) return map[action];
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (l) => l.toUpperCase());
}

function toActionTarget(user: AdminUserDetail["user"]): UserActionTarget {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    status: user.status,
  };
}

function AdminUserDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user: currentAdmin } = useAuth();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesTarget, setRolesTarget] = useState<ManageRolesTarget | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<{
    kind: UserActionKind;
    user: UserActionTarget;
  } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AdminUserDetail>(
        `/api/admin/users/${userId}`,
      );
      setDetail(response.data);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load user.";
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = () => {
    setRolesTarget(null);
    setPendingAction(null);
    void load();
  };

  const recentOrderTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of detail?.orders.items ?? []) {
      map.set(order.currency, (map.get(order.currency) ?? 0) + order.amountCents);
    }
    return Array.from(map.entries());
  }, [detail]);

  if (loading) {
    return (
      <main
        className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
      >
        <p className="text-sm text-muted">Loading user…</p>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className={`${ADMIN_PAGE_SHELL} space-y-4`}>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
        >
          ← Back
        </button>
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-100 sm:p-4">
          {error ?? "User not found."}
        </div>
      </main>
    );
  }

  const { user, organizerProfile, hostedEvents, orders, audit } = detail;
  const display = user.name || user.email;
  const isSelf = !!currentAdmin && currentAdmin.id === user.id;
  const isAdmin = user.roles.includes("ADMIN");
  const isSuspended = user.status === "SUSPENDED";
  const hostedTotal = countFromRecord(hostedEvents.byStatus);

  return (
    <main className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/users"
          className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
        >
          ← Users
        </Link>
        <span className="text-xs text-muted/60">/</span>
        <span className="text-xs text-muted">User detail</span>
      </div>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/85 p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/80 bg-wash text-lg font-semibold uppercase text-foreground/85">
              {userInitials({ name: user.name ?? undefined, email: user.email })}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="line-clamp-2 min-w-0 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground sm:line-clamp-1 sm:truncate sm:text-3xl">
                  {display}
                </h1>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(
                    user.status,
                  )}`}
                >
                  {user.status.toLowerCase()}
                </span>
                {isSelf ? (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    you
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {user.email}
                {user.phone ? (
                  <span className="text-muted/70"> · {user.phone}</span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleChipClass(
                      role,
                    )}`}
                  >
                    {role.toLowerCase()}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted tabular-nums">
                Joined {formatDate(user.createdAt)} · Updated{" "}
                {formatDate(user.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-1.5">
            <button
              type="button"
              onClick={() =>
                setRolesTarget({
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  roles: user.roles,
                })
              }
              className={ROW_ACTION_PRIMARY}
            >
              Manage roles
            </button>
            {!isAdmin ? (
              <button
                type="button"
                onClick={() =>
                  setPendingAction({
                    kind: "promote",
                    user: toActionTarget(user),
                  })
                }
                className={ROW_ACTION_GHOST}
              >
                Promote to admin
              </button>
            ) : null}
            {!isSuspended && !isSelf ? (
              <button
                type="button"
                onClick={() =>
                  setPendingAction({
                    kind: "forceLogout",
                    user: toActionTarget(user),
                  })
                }
                className={ROW_ACTION_GHOST}
              >
                Force sign-out
              </button>
            ) : null}
            {!isSuspended && !isSelf ? (
              <button
                type="button"
                onClick={() =>
                  setPendingAction({
                    kind: "suspend",
                    user: toActionTarget(user),
                  })
                }
                className={ROW_ACTION_DANGER}
              >
                Suspend
              </button>
            ) : null}
            {isSuspended ? (
              <button
                type="button"
                onClick={() =>
                  setPendingAction({
                    kind: "reactivate",
                    user: toActionTarget(user),
                  })
                }
                className={ROW_ACTION_PRIMARY}
              >
                Reactivate
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Hosted events" value={String(hostedTotal)} />
        <StatCard label="Orders placed" value={String(orders.total)} />
        <StatCard
          label="Recent order value"
          value={
            recentOrderTotals.length > 0
              ? recentOrderTotals
                  .map(([currency, cents]) =>
                    formatMoneyFromCents(cents, currency),
                  )
                  .join(" / ")
              : "—"
          }
          hint="Latest 8 orders"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <div className="space-y-4">
          <PanelHeader
            title="Organizer profile"
            eyebrow="Hosting"
            action={
              organizerProfile ? (
                <Link
                  href={`/admin/events?search=${encodeURIComponent(
                    organizerProfile.orgName,
                  )}`}
                  className={ROW_ACTION_GHOST}
                >
                  View events
                </Link>
              ) : null
            }
          />
          <OrganizerProfileCard profile={organizerProfile} />

          <PanelHeader
            title="Hosted events"
            eyebrow="Latest 8"
            action={
              organizerProfile ? (
                <Link
                  href={`/admin/events?search=${encodeURIComponent(
                    organizerProfile.orgName,
                  )}`}
                  className={ROW_ACTION_GHOST}
                >
                  Browse all
                </Link>
              ) : null
            }
          />
          <StatusSummary record={hostedEvents.byStatus} />
          {hostedEvents.items.length === 0 ? (
            <EmptyPanel message="No hosted events for this user." />
          ) : (
            <ul className="space-y-3">
              {hostedEvents.items.map((event) => (
                <HostedEventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <PanelHeader
            title="Orders placed"
            eyebrow="Support"
            action={
              <Link
                href={`/admin/orders?search=${encodeURIComponent(user.email)}`}
                className={ROW_ACTION_GHOST}
              >
                Search orders
              </Link>
            }
          />
          <StatusSummary record={orders.byStatus} />
          {orders.items.length === 0 ? (
            <EmptyPanel message="No orders are linked to this user." />
          ) : (
            <ul className="space-y-3">
              {orders.items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          )}

          <PanelHeader title="Audit trail" eyebrow="Latest 20" />
          {audit.length === 0 ? (
            <EmptyPanel message="No admin actions recorded for this user yet." />
          ) : (
            <ul className="space-y-2">
              {audit.map((entry) => (
                <AuditEntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <ManageUserRolesDialog
        user={rolesTarget}
        currentAdminId={currentAdmin?.id ?? null}
        onClose={() => setRolesTarget(null)}
        onSaved={onSaved}
      />
      <UserActionConfirmDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
        onDone={onSaved}
      />
    </main>
  );
}

const ROW_ACTION_BASE =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
const ROW_ACTION_PRIMARY = `${ROW_ACTION_BASE} border border-primary/55 bg-primary/15 text-primary hover:bg-primary/25 hover:text-foreground`;
const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} border border-red-400/40 bg-red-500/10 text-red-100 hover:border-red-400/60 hover:bg-red-500/20 hover:text-white`;
const ROW_ACTION_GHOST = `${ROW_ACTION_BASE} border border-transparent text-muted hover:border-border hover:bg-wash/40 hover:text-foreground`;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-3.5 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 break-words font-display text-xl font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function PanelHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0 sm:self-end">{action}</div> : null}
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-6 text-sm text-muted">
      {message}
    </div>
  );
}

function StatusSummary({ record }: { record: Record<string, number> }) {
  const entries = Object.entries(record).filter(([, count]) => Number(count) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map(([status, count]) => (
        <span
          key={status}
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(
            status,
          )}`}
        >
          {count} {labelFromEnum(status)}
        </span>
      ))}
    </div>
  );
}

function OrganizerProfileCard({
  profile,
}: {
  profile: AdminUserDetail["organizerProfile"];
}) {
  if (!profile) {
    return <EmptyPanel message="This user does not have an organizer profile." />;
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-lg font-semibold text-foreground">
          {profile.orgName}
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            profile.verified
              ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
              : "border-white/10 bg-white/[0.06] text-muted"
          }`}
        >
          {profile.verified ? "verified" : "unverified"}
        </span>
      </div>
      {profile.legalName ? (
        <p className="mt-1 text-sm text-muted">{profile.legalName}</p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <InfoItem label="Support email" value={profile.supportEmail} />
        <InfoItem label="Support phone" value={profile.supportPhone} />
        <InfoItem label="Website" value={profile.website} />
        <InfoItem label="Created" value={formatDate(profile.createdAt)} />
      </dl>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-foreground/90">{value || "—"}</dd>
    </div>
  );
}

function HostedEventRow({
  event,
}: {
  event: AdminUserDetail["hostedEvents"]["items"][number];
}) {
  const venueLine =
    [event.venue, event.city, event.country].filter(Boolean).join(" · ") ||
    null;

  return (
    <li className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-4 transition-[border-color] hover:border-primary/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/events/${event.id}`}
              className="min-w-0 truncate font-display text-base font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {event.title}
            </Link>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(
                event.status,
              )}`}
            >
              {labelFromEnum(event.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted tabular-nums">
            Starts {formatDate(event.startAt)} · {event.ticketTypeCount} ticket{" "}
            {event.ticketTypeCount === 1 ? "tier" : "tiers"}
          </p>
          {venueLine ? (
            <p className="mt-1 text-xs text-muted">{venueLine}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {event.slug ? (
            <Link
              href={`/events/${event.slug}`}
              target="_blank"
              rel="noopener"
              className={ROW_ACTION_GHOST}
            >
              View live
            </Link>
          ) : null}
          <Link href={`/admin/events/${event.id}`} className={ROW_ACTION_GHOST}>
            Inspect
          </Link>
        </div>
      </div>
    </li>
  );
}

function OrderRow({
  order,
}: {
  order: AdminUserDetail["orders"]["items"][number];
}) {
  const refLabel = order.reference || order.id.slice(0, 8);

  return (
    <li className="rounded-[var(--radius-panel)] border border-border bg-surface/80 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-foreground">
              {refLabel}
            </p>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(
                order.status,
              )}`}
            >
              {labelFromEnum(order.status)}
            </span>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100 tabular-nums">
              {formatMoneyFromCents(order.amountCents, order.currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {order.event ? (
              <Link
                href={`/admin/events/${order.event.id}`}
                className="font-medium text-foreground/85 underline-offset-2 hover:underline"
              >
                {order.event.title}
              </Link>
            ) : (
              "Event not found"
            )}
            <span className="text-muted/70">
              {" "}
              · {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
              {formatDate(order.createdAt)}
            </span>
          </p>
        </div>
        <Link
          href={`/admin/orders?search=${encodeURIComponent(refLabel)}`}
          className={ROW_ACTION_GHOST}
        >
          Find order
        </Link>
      </div>
    </li>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const meta = entry.metadata ?? {};
  const oldRoles = pickStringArray(meta, "oldRoles");
  const newRoles = pickStringArray(meta, "newRoles");
  const previousStatus = pickString(meta, "previousStatus");
  const newStatus = pickString(meta, "newStatus");
  const revokedSessionsRaw =
    typeof meta?.revokedSessions === "number" ? meta.revokedSessions : null;
  const reason = pickString(meta, "reason");

  return (
    <li className="rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {actionLabel(entry.action)}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {formatDate(entry.createdAt)}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        by {entry.admin?.name || entry.admin?.email || "System"}
        {entry.status === "FAILURE" ? (
          <span className="ml-2 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-100">
            failed
          </span>
        ) : null}
      </p>
      {oldRoles && newRoles ? (
        <p className="mt-1 text-xs text-foreground/80">
          Roles: <span className="text-muted">{oldRoles.join(", ") || "—"}</span>
          {" → "}
          <span>{newRoles.join(", ") || "—"}</span>
        </p>
      ) : null}
      {previousStatus && newStatus ? (
        <p className="mt-1 text-xs text-foreground/80">
          Status: <span className="text-muted">{previousStatus}</span> →{" "}
          <span>{newStatus}</span>
        </p>
      ) : null}
      {revokedSessionsRaw !== null ? (
        <p className="mt-1 text-xs text-muted">
          Revoked {revokedSessionsRaw}{" "}
          {revokedSessionsRaw === 1 ? "session" : "sessions"}
        </p>
      ) : null}
      {reason ? (
        <p className="mt-1 text-xs italic leading-snug text-muted">“{reason}”</p>
      ) : null}
    </li>
  );
}

export default function AdminUserDetailPage() {
  return (
    <Suspense
      fallback={
        <main
          className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
        >
          <p className="text-sm text-muted">Loading user…</p>
        </main>
      }
    >
      <AdminUserDetailPageContent />
    </Suspense>
  );
}
