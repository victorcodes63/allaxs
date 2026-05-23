"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

interface AdminOverrideEntry {
  id: string;
  action: string;
  createdAt: string;
}

interface AdminOverrideSummary {
  hasRecentAdminEdits: boolean;
  withinDays: number;
  recentEditCount: number;
  lastEditedAt: string | null;
  entries: AdminOverrideEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  ADMIN_UPDATE_EVENT: "Updated event details",
  ADMIN_UPDATE_EVENT_BANNER: "Updated the banner",
  ADMIN_SUBMIT_EVENT: "Submitted the event for review",
  ADMIN_CREATE_TICKET_TYPE: "Added a ticket tier",
  ADMIN_UPDATE_TICKET_TYPE: "Updated a ticket tier",
  ADMIN_DELETE_TICKET_TYPE: "Removed a ticket tier",
  ADMIN_CREATE_COUPON: "Added a coupon",
  ADMIN_UPDATE_COUPON: "Updated a coupon",
  ADMIN_DELETE_COUPON: "Removed a coupon",
  ADMIN_DISABLE_COUPON: "Disabled a coupon",
  ADMIN_DELETE_EVENT: "Deleted the event",
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .replace(/^ADMIN_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function uniqueActionLabels(entries: AdminOverrideEntry[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const entry of entries) {
    const label = actionLabel(entry.action);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

interface OrganizerAdminEditBannerProps {
  eventId: string;
}

/**
 * Warns organisers when platform admins recently edited their event via the
 * audit-logged override path (ADMIN_* actions on `admin_audit_logs`).
 */
export function OrganizerAdminEditBanner({
  eventId,
}: OrganizerAdminEditBannerProps) {
  const [summary, setSummary] = useState<AdminOverrideSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await axios.get<AdminOverrideSummary>(
          `/api/events/${eventId}/admin-overrides`,
        );
        if (!cancelled) setSummary(response.data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const actionSummaries = useMemo(
    () => (summary?.entries ? uniqueActionLabels(summary.entries) : []),
    [summary?.entries],
  );

  if (loading || !summary?.hasRecentAdminEdits) {
    return null;
  }

  const lastWhen = summary.lastEditedAt
    ? formatWhen(summary.lastEditedAt)
    : null;

  return (
    <div
      className="rounded-[var(--radius-panel)] border border-amber-400/35 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-50 sm:px-5"
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/90">
        Platform admin edit
      </p>
      <p className="mt-1.5 leading-relaxed text-amber-50/95">
        An AllAXS admin recently changed this event on your behalf. Review your
        details, media, ticket tiers, and coupons before you publish or resubmit
        — you may be working from outdated information.
      </p>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-amber-100/85">
        {lastWhen ? (
          <li>
            Last change: <span className="text-amber-50">{lastWhen}</span>
          </li>
        ) : null}
        <li>
          {summary.recentEditCount}{" "}
          {summary.recentEditCount === 1 ? "change" : "changes"} in the last{" "}
          {summary.withinDays} days
        </li>
      </ul>
      {actionSummaries.length > 0 ? (
        <p className="mt-2 text-xs text-amber-100/80">
          Includes: {actionSummaries.slice(0, 4).join(" · ")}
          {actionSummaries.length > 4
            ? ` · +${actionSummaries.length - 4} more`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
