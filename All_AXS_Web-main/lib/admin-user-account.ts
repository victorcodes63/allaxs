export type AdminUserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export const CLOSED_ACCOUNT_EMAIL_SUFFIX = "@closed.allaxs.internal";
export const CLOSED_ACCOUNT_DISPLAY_NAME = "Closed account";

export type AdminUserAccountFields = {
  email: string;
  name?: string | null;
  status: string;
};

/** Self-closed account (CLOSED status or legacy scrubbed rows). */
export function isClosedAccount(user: AdminUserAccountFields): boolean {
  if (user.status === "CLOSED") return true;
  const email = user.email.trim().toLowerCase();
  return (
    email.endsWith(CLOSED_ACCOUNT_EMAIL_SUFFIX) ||
    user.name === CLOSED_ACCOUNT_DISPLAY_NAME
  );
}

export function accountStatusLabel(user: AdminUserAccountFields): string {
  if (isClosedAccount(user)) return "closed";
  return user.status.toLowerCase();
}

export function accountStatusChipClass(user: AdminUserAccountFields): string {
  if (isClosedAccount(user)) {
    return "border-white/15 bg-white/[0.08] text-muted";
  }
  return user.status === "ACTIVE"
    ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
    : "border-red-400/30 bg-red-500/12 text-red-100";
}

import { platformSupportMailto } from "@/lib/site-contact";

export function supportRestoreMailto(userId: string): string {
  const subject = encodeURIComponent("Restore closed All AXS account");
  const body = encodeURIComponent(
    `Please restore access for user id: ${userId}\n\nOriginal email (if known):\n\nReason for restore:\n`,
  );
  return `${platformSupportMailto()}?subject=${subject}&body=${body}`;
}
