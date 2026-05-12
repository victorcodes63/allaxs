"use client";

import { useCallback, useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface AuditEntry {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  admin: { id: string; email: string; name?: string | null } | null;
}

interface UserAuditDialogProps {
  user: { id: string; email: string; name?: string | null } | null;
  onClose: () => void;
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
    <li className="flex flex-col gap-1 rounded-[var(--radius-panel)] border border-border/70 bg-surface/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {actionLabel(entry.action)}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {formatDate(entry.createdAt)}
        </p>
      </div>
      <p className="text-xs text-muted">
        by {entry.admin?.name || entry.admin?.email || "System"}
        {entry.status === "FAILURE" ? (
          <span className="ml-2 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-100">
            failed
          </span>
        ) : null}
      </p>
      {oldRoles && newRoles ? (
        <p className="text-xs text-foreground/80">
          Roles:{" "}
          <span className="text-muted">{oldRoles.join(", ") || "—"}</span>
          {" → "}
          <span>{newRoles.join(", ") || "—"}</span>
        </p>
      ) : null}
      {previousStatus && newStatus ? (
        <p className="text-xs text-foreground/80">
          Status:{" "}
          <span className="text-muted">{previousStatus}</span> →{" "}
          <span>{newStatus}</span>
        </p>
      ) : null}
      {revokedSessionsRaw !== null ? (
        <p className="text-xs text-muted">
          Revoked {revokedSessionsRaw}{" "}
          {revokedSessionsRaw === 1 ? "session" : "sessions"}
        </p>
      ) : null}
      {reason ? (
        <p className="text-xs italic leading-snug text-muted">“{reason}”</p>
      ) : null}
    </li>
  );
}

export function UserAuditDialog({ user, onClose }: UserAuditDialogProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AuditEntry[]>(
        `/api/admin/users/${user.id}/audit`,
      );
      setEntries(response.data ?? []);
    } catch (err) {
      const message = isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.message
        : "Failed to load audit history.";
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) return null;

  return (
    <Dialog
      open={!!user}
      onClose={onClose}
      title="Audit history"
      ariaLabel="User audit history"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="w-auto">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-display text-base font-semibold text-foreground">
            {user.name || user.email}
          </p>
          <p className="mt-0.5 text-xs text-muted">{user.email}</p>
        </div>
        {error ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted">Loading audit history…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">
            No admin actions recorded for this user yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
