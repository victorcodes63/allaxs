"use client";

import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export type AdminRole = "ADMIN" | "ORGANIZER" | "ATTENDEE";

const ROLE_OPTIONS: ReadonlyArray<{
  value: AdminRole;
  label: string;
  hint: string;
}> = [
  {
    value: "ATTENDEE",
    label: "Attendee",
    hint: "Buy tickets, follow events, manage their fan hub.",
  },
  {
    value: "ORGANIZER",
    label: "Organizer",
    hint: "Create events, manage tiers and sales.",
  },
  {
    value: "ADMIN",
    label: "Admin",
    hint: "Full moderation, refunds, role management.",
  },
];

export interface ManageRolesTarget {
  id: string;
  email: string;
  name?: string | null;
  roles: AdminRole[];
}

interface ManageUserRolesDialogProps {
  user: ManageRolesTarget | null;
  /** ID of the currently-logged-in admin, used to prevent self-demotion. */
  currentAdminId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ManageUserRolesDialog({
  user,
  currentAdminId,
  onClose,
  onSaved,
}: ManageUserRolesDialogProps) {
  const [selected, setSelected] = useState<AdminRole[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSelected(user.roles);
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  const isSelf = !!currentAdminId && currentAdminId === user.id;
  const removingOwnAdmin = isSelf && !selected.includes("ADMIN");
  const noRolesLeft = selected.length === 0;
  const unchanged =
    selected.length === user.roles.length &&
    selected.every((role) => user.roles.includes(role));

  const toggle = (role: AdminRole) => {
    setSelected((current) =>
      current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role],
    );
  };

  const submit = async () => {
    setError(null);
    if (noRolesLeft) {
      setError("Every user must keep at least one role.");
      return;
    }
    if (removingOwnAdmin) {
      setError("You cannot remove your own admin role.");
      return;
    }
    setSubmitting(true);
    try {
      await axios.patch(`/api/admin/users/${user.id}/roles`, {
        roles: selected,
      });
      onSaved();
    } catch (err) {
      const fallback = "Failed to update roles. Please try again.";
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const apiMessage = (
          err.response?.data as { message?: string } | undefined
        )?.message;
        if (status === 400) {
          setError(apiMessage ?? "Validation failed.");
        } else if (status === 403) {
          setError("You do not have permission to manage roles.");
        } else if (status === 404) {
          setError("User not found.");
        } else {
          setError(apiMessage ?? err.message ?? fallback);
        }
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!user}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Manage roles"
      ariaLabel="Manage user roles"
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
            onClick={submit}
            disabled={submitting || unchanged || noRolesLeft || removingOwnAdmin}
            className="w-auto"
          >
            {submitting ? "Saving…" : "Save roles"}
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

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Roles
          </legend>
          {ROLE_OPTIONS.map((option) => {
            const checked = selected.includes(option.value);
            const disable =
              isSelf && option.value === "ADMIN" && checked;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-panel)] border p-3 transition-[border-color,background-color] ${
                  checked
                    ? "border-primary/55 bg-primary/10"
                    : "border-border/70 bg-surface/70 hover:border-primary/30"
                } ${disable ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[--color-primary]"
                  checked={checked}
                  disabled={disable}
                  onChange={() => toggle(option.value)}
                  aria-describedby={`role-${option.value}-hint`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {option.label}
                  </p>
                  <p
                    id={`role-${option.value}-hint`}
                    className="mt-0.5 text-xs text-muted"
                  >
                    {option.hint}
                  </p>
                </div>
              </label>
            );
          })}
        </fieldset>

        {isSelf ? (
          <p className="text-xs text-amber-200/80">
            You cannot remove your own admin role.
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
