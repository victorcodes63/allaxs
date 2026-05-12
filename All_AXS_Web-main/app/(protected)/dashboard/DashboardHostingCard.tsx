"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import {
  normalizeOrganizerProfilePayload,
  type OrganizerProfileDisplay,
} from "@/lib/organizer-profile-display";

type HostingState =
  | "loading"
  | "attendee_only"
  | "organizer_no_profile"
  | "organizer_pending"
  | "organizer_approved"
  | "error";

type HostingCardModel = {
  state: HostingState;
  label: string;
  href: string;
  hint: string;
};

function modelForState(state: HostingState, profile: OrganizerProfileDisplay | null): HostingCardModel {
  switch (state) {
    case "attendee_only":
      return {
        state,
        label: "Become a host",
        href: "/organizer/onboarding",
        hint: "Set up your organizer profile in two steps, then open your host workspace.",
      };
    case "organizer_no_profile":
      return {
        state,
        label: "Continue host setup",
        href: "/organizer/onboarding",
        hint: "You already have host access. Finish your organizer profile to start publishing events.",
      };
    case "organizer_pending":
      return {
        state,
        label: "Open organizer account",
        href: "/organizer/account",
        hint:
          "Your organizer profile is saved and awaiting verification. You can still update support and payout details.",
      };
    case "organizer_approved":
      return {
        state,
        label: "Open Organizer hub",
        href: "/organizer/dashboard",
        hint: profile?.orgName
          ? `${profile.orgName} is verified and ready to publish events.`
          : "Your organizer profile is verified and ready to publish events.",
      };
    case "loading":
      return {
        state,
        label: "Checking hosting status…",
        href: "#",
        hint: "Loading your organizer access and profile details.",
      };
    default:
      return {
        state,
        label: "Open organizer setup",
        href: "/organizer/onboarding",
        hint: "We could not confirm your hosting status, but you can continue setup here.",
      };
  }
}

export function DashboardHostingCard() {
  const { user, loading } = useAuth();
  const hasOrganizerRole = user?.roles?.includes("ORGANIZER") ?? false;
  const [state, setState] = useState<HostingState>("loading");
  const [profile, setProfile] = useState<OrganizerProfileDisplay | null>(null);

  useEffect(() => {
    if (loading || !user || !hasOrganizerRole) return;

    let cancelled = false;
    void (async () => {
      try {
        await axios.post("/api/auth/promote-organizer").catch(() => undefined);
        const res = await axios.get("/api/organizer/profile");
        if (cancelled) return;
        const normalized = normalizeOrganizerProfilePayload(res.data);
        setProfile(normalized);
        if (!normalized) {
          setState("organizer_no_profile");
          return;
        }
        setState(normalized.verified ? "organizer_approved" : "organizer_pending");
      } catch (error) {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          setState("organizer_no_profile");
          return;
        }
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasOrganizerRole, loading, user]);

  const effectiveState: HostingState = loading
    ? "loading"
    : !user
      ? "error"
      : !hasOrganizerRole
        ? "attendee_only"
        : state;
  const model = useMemo(() => modelForState(effectiveState, profile), [effectiveState, profile]);
  const loadingState = effectiveState === "loading";

  return (
    <li className="flex flex-col rounded-[var(--radius-panel)] border border-border bg-background p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Hosting</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Sell your own line-ups on All AXS with payouts, ticket types, and review before going live.
      </p>
      <div className="mt-4 space-y-3 border-t border-border/80 pt-4">
        {loadingState ? (
          <p className="text-sm font-medium text-muted">Checking hosting status…</p>
        ) : (
          <div>
            <Link
              href={model.href}
              className="text-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              {model.label}
            </Link>
            <p className="mt-0.5 text-xs text-muted">{model.hint}</p>
          </div>
        )}
      </div>
    </li>
  );
}
