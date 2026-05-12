"use client";

import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export type UserActionKind =
  | "promote"
  | "suspend"
  | "reactivate"
  | "forceLogout";

export interface UserActionTarget {
  id: string;
  email: string;
  name?: string | null;
  roles: string[];
  status: "ACTIVE" | "SUSPENDED";
}

interface UserActionConfirmDialogProps {
  action: { kind: UserActionKind; user: UserActionTarget } | null;
  onClose: () => void;
  onDone: () => void;
}

const PRESETS: Record<
  UserActionKind,
  {
    title: string;
    confirmLabel: (target: UserActionTarget) => string;
    description: (target: UserActionTarget) => React.ReactNode;
    danger: boolean;
  }
> = {
  promote: {
    title: "Promote to admin",
    confirmLabel: () => "Promote",
    description: (target) => (
      <>
        Grant full admin privileges to{" "}
        <span className="font-semibold text-foreground">
          {target.name || target.email}
        </span>
        ? They will be able to approve events, refund orders, manage user
        roles, and suspend accounts. The change is logged in the admin audit
        trail.
      </>
    ),
    danger: false,
  },
  suspend: {
    title: "Suspend account",
    confirmLabel: () => "Suspend",
    description: (target) => (
      <>
        Mark{" "}
        <span className="font-semibold text-foreground">
          {target.name || target.email}
        </span>{" "}
        as suspended? Every active session will be revoked immediately and
        the user will be unable to sign in until reactivated. The change is
        logged in the admin audit trail.
      </>
    ),
    danger: true,
  },
  reactivate: {
    title: "Reactivate account",
    confirmLabel: () => "Reactivate",
    description: (target) => (
      <>
        Restore{" "}
        <span className="font-semibold text-foreground">
          {target.name || target.email}
        </span>{" "}
        to active status?
      </>
    ),
    danger: false,
  },
  forceLogout: {
    title: "Force sign-out",
    confirmLabel: () => "Sign out everywhere",
    description: (target) => (
      <>
        Revoke every active session for{" "}
        <span className="font-semibold text-foreground">
          {target.name || target.email}
        </span>
        ? They will need to sign in again on every device. Their account
        status, roles, and data are not changed.
      </>
    ),
    danger: true,
  },
};

export function UserActionConfirmDialog({
  action,
  onClose,
  onDone,
}: UserActionConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) {
      setError(null);
      setSubmitting(false);
    }
  }, [action]);

  if (!action) return null;

  const { kind, user } = action;
  const preset = PRESETS[kind];

  const run = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (kind === "promote") {
        const nextRoles = user.roles.includes("ADMIN")
          ? user.roles
          : [...user.roles, "ADMIN"];
        await axios.patch(`/api/admin/users/${user.id}/roles`, {
          roles: nextRoles,
        });
      } else if (kind === "forceLogout") {
        await axios.post(`/api/admin/users/${user.id}/force-logout`, {});
      } else {
        await axios.patch(`/api/admin/users/${user.id}/status`, {
          status: kind === "suspend" ? "SUSPENDED" : "ACTIVE",
        });
      }
      onDone();
    } catch (err) {
      const fallback = "Action failed. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (
          err.response?.data as { message?: string } | undefined
        )?.message;
        if (status === 400) setError(apiMessage ?? "Validation failed.");
        else if (status === 403)
          setError("You do not have permission for that action.");
        else if (status === 404) setError("User not found.");
        else setError(apiMessage ?? err.message ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!action}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={preset.title}
      ariaLabel={preset.title}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={run}
            disabled={submitting}
            className={
              preset.danger
                ? "w-auto bg-red-600 text-white hover:bg-red-700"
                : "w-auto"
            }
          >
            {submitting ? "Working…" : preset.confirmLabel(user)}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-[var(--radius-panel)] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        <p className="text-sm leading-relaxed text-foreground/85">
          {preset.description(user)}
        </p>
      </div>
    </Dialog>
  );
}
