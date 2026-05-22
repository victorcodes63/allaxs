"use client";

import { Suspense, useCallback, useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { buildAuthQuery } from "@/lib/auth/post-auth-redirect";
import { Button } from "@/components/ui/Button";
import {
  formatTeamDate,
  orgMemberRoleHint,
  orgMemberRoleLabel,
  type OrganizerInviteAcceptResult,
  type OrganizerInvitePreview,
} from "@/lib/organizer-team";

function TeamJoinContent(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<OrganizerInvitePreview | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<OrganizerInviteAcceptResult | null>(null);

  const loadPreview = useCallback(async () => {
    if (!token) {
      setLoadError("This invite link is missing a token.");
      setLoadState("error");
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await axios.get<OrganizerInvitePreview>(
        `/api/organizer/team/invites/preview?token=${encodeURIComponent(token)}`,
      );
      setPreview(res.data);
      setLoadState("ready");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setLoadError(message || "This invite is invalid or has expired.");
      setLoadState("error");
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const signedInEmail = user?.email?.trim().toLowerCase() ?? "";
  const inviteEmail = preview?.email?.trim().toLowerCase() ?? "";
  const emailMatches =
    Boolean(signedInEmail && inviteEmail) && signedInEmail === inviteEmail;

  const onAccept = async () => {
    if (!token) return;
    setAcceptError(null);
    setAccepting(true);
    try {
      const res = await axios.post<OrganizerInviteAcceptResult>(
        "/api/organizer/team/invites/accept",
        { token },
      );
      setAccepted(res.data);
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setAcceptError(message || "We could not accept this invite.");
    } finally {
      setAccepting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Invalid invite link
        </h1>
        <p className="text-sm text-muted">
          Ask the organizer to send a fresh invitation from their team settings.
        </p>
        <Link href="/">
          <Button variant="secondary" className="w-auto min-w-[10rem]">
            Go home
          </Button>
        </Link>
      </div>
    );
  }

  if (loadState === "loading" || authLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading invitation…</p>
        <p className="text-xs text-muted">Checking invite details</p>
      </div>
    );
  }

  if (loadState === "error" || !preview) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Invite unavailable
        </h1>
        <p className="text-sm text-muted">{loadError}</p>
        <Button type="button" variant="secondary" className="w-auto min-w-[10rem]" onClick={() => void loadPreview()}>
          Retry
        </Button>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="mx-auto max-w-xl space-y-8 px-4 py-8 sm:py-12">
        <header className="space-y-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Team invite</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            You&apos;re in
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            You joined <span className="font-medium text-foreground">{accepted.orgName}</span> as{" "}
            <span className="font-medium text-foreground">{orgMemberRoleLabel(accepted.role)}</span>.
          </p>
        </header>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/organizer/dashboard">
            <Button className="w-auto min-w-[10rem]">Open organizer hub</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" className="w-auto min-w-[10rem]">
              Fan account home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const loginHref = `/login${buildAuthQuery({
    next: `/organizer/team/join?token=${encodeURIComponent(token)}`,
    intent: "host",
  })}`;

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Team invite</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Join {preview.orgName}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          You&apos;ve been invited as{" "}
          <span className="font-medium text-foreground">{orgMemberRoleLabel(preview.role)}</span>.{" "}
          {orgMemberRoleHint(preview.role)}
        </p>
      </header>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted">Organization</dt>
            <dd className="mt-0.5 font-medium text-foreground">{preview.orgName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Role</dt>
            <dd className="mt-0.5 font-medium text-foreground">{orgMemberRoleLabel(preview.role)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Invited email</dt>
            <dd className="mt-0.5 truncate font-medium text-foreground">{preview.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Expires</dt>
            <dd className="mt-0.5 font-medium text-foreground">{formatTeamDate(preview.expiresAt)}</dd>
          </div>
        </dl>
      </section>

      {!user ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Sign in with <span className="font-medium text-foreground">{preview.email}</span> to accept
            this invitation.
          </p>
          <Link href={loginHref}>
            <Button className="w-auto min-w-[12rem]">Sign in to accept</Button>
          </Link>
        </div>
      ) : emailMatches ? (
        <div className="space-y-4">
          {acceptError ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              {acceptError}
            </div>
          ) : null}
          <p className="text-sm text-muted">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>.
          </p>
          <Button
            type="button"
            className="w-auto min-w-[12rem]"
            disabled={accepting}
            onClick={() => void onAccept()}
          >
            {accepting ? "Accepting…" : "Accept invitation"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            Sign in with <span className="font-semibold">{preview.email}</span> to accept. You are
            currently signed in as {user.email}.
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={loginHref}>
              <Button className="w-auto min-w-[12rem]">Switch account</Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              className="w-auto min-w-[10rem]"
              onClick={() => router.push("/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizerTeamJoinPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-foreground">Loading invitation…</p>
        </div>
      }
    >
      <TeamJoinContent />
    </Suspense>
  );
}
