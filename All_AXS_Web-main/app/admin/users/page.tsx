"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { userInitials } from "@/lib/hub-user";
import { useAuth } from "@/lib/auth";
import {
  ManageUserRolesDialog,
  type AdminRole,
  type ManageRolesTarget,
} from "@/components/admin/ManageUserRolesDialog";
import { UserAuditDialog } from "@/components/admin/UserAuditDialog";
import {
  UserActionConfirmDialog,
  type UserActionKind,
  type UserActionTarget,
} from "@/components/admin/UserActionConfirmDialog";
import { ADMIN_PAGE_SHELL } from "@/lib/admin-page-shell";

type UserStatus = "ACTIVE" | "SUSPENDED";

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  roles: AdminRole[];
  status: UserStatus;
  createdAt: string;
}

interface AdminUsersResponse {
  items: AdminUserRow[];
  total: number;
  limit: number;
  offset: number;
}

const ROLE_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "ADMIN", label: "Admins" },
  { value: "ORGANIZER", label: "Organizers" },
  { value: "ATTENDEE", label: "Attendees" },
];

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "All states" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

const PAGE_SIZE = 25;

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

function statusChipClass(status: UserStatus): string {
  return status === "ACTIVE"
    ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
    : "border-red-400/30 bg-red-500/12 text-red-100";
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

function AdminUsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentAdmin } = useAuth();

  const initialSearch = searchParams.get("search") ?? "";
  const initialRole =
    ROLE_FILTERS.find((f) => f.value === searchParams.get("role"))?.value ??
    "all";
  const initialStatus =
    STATUS_FILTERS.find((f) => f.value === searchParams.get("status"))?.value ??
    "all";
  const initialOffset = Math.max(
    Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );

  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>(initialRole);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [rolesTarget, setRolesTarget] = useState<ManageRolesTarget | null>(
    null,
  );
  const [auditTarget, setAuditTarget] = useState<{
    id: string;
    email: string;
    name?: string | null;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: UserActionKind;
    user: UserActionTarget;
  } | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setOffset(0);
  }, [roleFilter, statusFilter, debouncedSearch]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (roleFilter !== "all") sp.set("role", roleFilter);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    sp.set("limit", String(PAGE_SIZE));
    sp.set("offset", String(offset));
    return sp.toString();
  }, [roleFilter, statusFilter, debouncedSearch, offset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AdminUsersResponse>(
        `/api/admin/users?${queryString}`,
      );
      setData(response.data);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load users.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (roleFilter !== "all") sp.set("role", roleFilter);
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
    if (offset > 0) sp.set("offset", String(offset));
    const qs = sp.toString();
    router.replace(qs ? `/admin/users?${qs}` : "/admin/users", {
      scroll: false,
    });
  }, [router, roleFilter, statusFilter, debouncedSearch, offset]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + items.length, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const onSaved = () => {
    setRolesTarget(null);
    setPendingAction(null);
    void load();
  };

  return (
    <main className={`${ADMIN_PAGE_SHELL} space-y-6 sm:space-y-8`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Admin
          </p>
          <h1 className="mt-1.5 font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            Users
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Manage roles and account status for everyone on the platform. All
            changes are recorded in the admin audit trail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted sm:shrink-0">
          <span className="rounded-full border border-border/70 bg-surface/80 px-3 py-1">
            {total} total
          </span>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-100">
            {items.filter((u) => u.roles.includes("ADMIN")).length} admins on page
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-[2]">
            <label
              htmlFor="admin-users-search"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted"
            >
              Search
            </label>
            <input
              id="admin-users-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Email or name…"
              className="h-10 w-full rounded-[var(--radius-button)] border border-border/80 bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
              aria-label="Search users"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-1.5 sm:flex-none">
            {ROLE_FILTERS.map((filter) => {
              const active = filter.value === roleFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRoleFilter(filter.value)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-[border-color,background-color,color] ${
                    active
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border bg-surface/80 text-muted hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.value === statusFilter;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-[border-color,background-color,color] ${
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-surface/80 text-muted hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3.5 text-sm leading-relaxed text-red-100 sm:p-4">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          Loading users…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface/70 p-10 text-center text-sm text-muted">
          {debouncedSearch.trim() ||
          roleFilter !== "all" ||
          statusFilter !== "all"
            ? "No users match the current filters."
            : "No users registered yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <AdminUserCard
              key={row.id}
              row={row}
              isSelf={!!currentAdmin && currentAdmin.id === row.id}
              onManageRoles={() =>
                setRolesTarget({
                  id: row.id,
                  email: row.email,
                  name: row.name,
                  roles: row.roles,
                })
              }
              onOpenAudit={() =>
                setAuditTarget({
                  id: row.id,
                  email: row.email,
                  name: row.name,
                })
              }
              onPromote={() =>
                setPendingAction({
                  kind: "promote",
                  user: toActionTarget(row),
                })
              }
              onSuspend={() =>
                setPendingAction({
                  kind: "suspend",
                  user: toActionTarget(row),
                })
              }
              onReactivate={() =>
                setPendingAction({
                  kind: "reactivate",
                  user: toActionTarget(row),
                })
              }
              onForceLogout={() =>
                setPendingAction({
                  kind: "forceLogout",
                  user: toActionTarget(row),
                })
              }
            />
          ))}
        </ul>
      )}

      {total > 0 ? (
        <nav
          aria-label="Users pagination"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-4 py-3 text-xs text-muted"
        >
          <p className="tabular-nums">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={!hasPrev}
              className="inline-flex h-8 items-center rounded-full border border-border bg-surface/80 px-3 font-semibold transition-[border-color,color,background-color] enabled:hover:border-primary/40 enabled:hover:text-foreground disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasNext}
              className="inline-flex h-8 items-center rounded-full border border-border bg-surface/80 px-3 font-semibold transition-[border-color,color,background-color] enabled:hover:border-primary/40 enabled:hover:text-foreground disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </nav>
      ) : null}

      <ManageUserRolesDialog
        user={rolesTarget}
        currentAdminId={currentAdmin?.id ?? null}
        onClose={() => setRolesTarget(null)}
        onSaved={onSaved}
      />
      <UserAuditDialog
        user={auditTarget}
        onClose={() => setAuditTarget(null)}
      />
      <UserActionConfirmDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
        onDone={onSaved}
      />
    </main>
  );
}

function toActionTarget(row: AdminUserRow): UserActionTarget {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: row.roles,
    status: row.status,
  };
}

const ROW_ACTION_BASE =
  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";
const ROW_ACTION_PRIMARY = `${ROW_ACTION_BASE} border border-primary/55 bg-primary/15 text-primary hover:bg-primary/25 hover:text-foreground`;
const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} border border-red-400/40 bg-red-500/10 text-red-100 hover:border-red-400/60 hover:bg-red-500/20 hover:text-white`;
const ROW_ACTION_GHOST = `${ROW_ACTION_BASE} border border-transparent text-muted hover:border-border hover:bg-wash/40 hover:text-foreground`;

function AdminUserCard({
  row,
  isSelf,
  onManageRoles,
  onOpenAudit,
  onPromote,
  onSuspend,
  onReactivate,
  onForceLogout,
}: {
  row: AdminUserRow;
  isSelf: boolean;
  onManageRoles: () => void;
  onOpenAudit: () => void;
  onPromote: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onForceLogout: () => void;
}) {
  const display = row.name || row.email;
  const isAdmin = row.roles.includes("ADMIN");
  const isSuspended = row.status === "SUSPENDED";

  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-surface/85 p-4 transition-[border-color,box-shadow] hover:border-primary/30 sm:flex-row sm:items-start sm:p-5">
      <div className="flex shrink-0 items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-wash text-base font-semibold uppercase text-foreground/85">
          {userInitials({ name: row.name ?? undefined, email: row.email })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 min-w-0 font-display text-base font-semibold leading-snug tracking-tight text-foreground sm:line-clamp-1 sm:truncate sm:text-lg">
            {display}
          </h3>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChipClass(row.status)}`}
          >
            {row.status.toLowerCase()}
          </span>
          {isSelf ? (
            <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              you
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted">
          {row.email}
          {row.phone ? (
            <span className="text-muted/70"> · {row.phone}</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.roles.map((role) => (
            <span
              key={role}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleChipClass(role)}`}
            >
              {role.toLowerCase()}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted tabular-nums">
          Joined {formatDate(row.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-1.5 sm:items-end sm:justify-end sm:self-center">
        <Link
          href={`/admin/users/${row.id}`}
          className={ROW_ACTION_PRIMARY}
          aria-label={`Open detail page for ${display}`}
        >
          Details
        </Link>
        <button
          type="button"
          onClick={onManageRoles}
          className={ROW_ACTION_GHOST}
        >
          Manage roles
        </button>
        {!isAdmin ? (
          <button
            type="button"
            onClick={onPromote}
            className={ROW_ACTION_GHOST}
            aria-label={`Promote ${display} to admin`}
          >
            Promote to admin
          </button>
        ) : null}
        {!isSuspended && !isSelf ? (
          <button
            type="button"
            onClick={onForceLogout}
            className={ROW_ACTION_GHOST}
            aria-label={`Force sign-out ${display}`}
          >
            Force sign-out
          </button>
        ) : null}
        {!isSuspended && !isSelf ? (
          <button
            type="button"
            onClick={onSuspend}
            className={ROW_ACTION_DANGER}
            aria-label={`Suspend ${display}`}
          >
            Suspend
          </button>
        ) : null}
        {isSuspended ? (
          <button
            type="button"
            onClick={onReactivate}
            className={ROW_ACTION_PRIMARY}
            aria-label={`Reactivate ${display}`}
          >
            Reactivate
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenAudit}
          className={ROW_ACTION_GHOST}
          aria-label={`Audit history for ${display}`}
        >
          Audit
        </button>
      </div>
    </li>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <main
          className={`${ADMIN_PAGE_SHELL} flex min-h-[min(40vh,20rem)] flex-col justify-center py-12 sm:py-16`}
        >
          <p className="text-sm text-muted">Loading users…</p>
        </main>
      }
    >
      <AdminUsersPageContent />
    </Suspense>
  );
}
