"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import { useAuth } from "@/lib/auth";
import { organizerProfileApiToFormValues } from "@/lib/organizer-profile-form-map";
import type { OrganizerOnboardingInput } from "@/lib/validation/organizer";
import { OrganizerProfileEditForm } from "@/components/organizer/OrganizerProfileEditForm";
import { Button } from "@/components/ui/Button";

export default function OrganizerAccountPage(): ReactElement {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<OrganizerOnboardingInput | null>(null);

  const runLoadAccount = useCallback(async () => {
    try {
      const res = await axios.get<unknown>("/api/organizer/profile");
      const mapped = organizerProfileApiToFormValues(res.data);
      if (!mapped) {
        setLoadError(
          "Your profile response was missing required fields. Contact support if this persists.",
        );
        setLoadState("error");
        return;
      }
      setFormValues(mapped);
      setLoadState("ready");
      setLoadError(null);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        router.replace("/organizer/onboarding");
        return;
      }
      const message =
        isAxiosError(err) && err.response?.data && typeof err.response.data === "object"
          ? (err.response.data as { message?: string }).message
          : undefined;
      setLoadError(message || "We could not load your organizer profile.");
      setLoadState("error");
    }
  }, [router]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runLoadAccount();
    }, 0);
    return () => window.clearTimeout(id);
  }, [runLoadAccount]);

  if (authLoading) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading…</p>
        <p className="text-xs text-muted">Checking your session</p>
      </div>
    );
  }

  if (loadState === "loading" || (loadState === "ready" && !formValues)) {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium text-foreground">Loading account…</p>
        <p className="text-xs text-muted">Organizer profile</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-md text-sm text-muted">{loadError}</p>
        <Button
          type="button"
          className="w-auto"
          onClick={() => {
            setLoadState("loading");
            void runLoadAccount();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Organiser</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Account
            </h1>
            <p className="text-sm leading-relaxed text-muted sm:text-base">
              Manage your sign-in identity and your public organizer profile in one place. Profile
              changes apply to new and existing event listings after save.
            </p>
          </div>
        </div>
      </header>

      <section
        aria-labelledby="signin-heading"
        className="rounded-[var(--radius-panel)] border border-border bg-surface/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
      >
        <h2 id="signin-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/50">
          Sign-in &amp; security
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Your email is your All AXS username. Password changes use a secure email link so we never
          collect a new password on this screen.
        </p>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-0.5 truncate font-medium text-foreground">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Display name</dt>
            <dd className="mt-0.5 font-medium text-foreground">{user?.name?.trim() || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted">Roles</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {(user?.roles?.length ? user.roles : ["ATTENDEE"]).map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80"
                >
                  {role.replace(/_/g, " ")}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border/80 pt-6">
          <Link href="/forgot-password">
            <Button variant="secondary" type="button" className="w-auto min-w-[10rem]">
              Change password
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" type="button" className="w-auto min-w-[10rem]">
              Fan account home
            </Button>
          </Link>
        </div>
      </section>

      {formValues ? (
        <OrganizerProfileEditForm
          initialValues={formValues}
          onAfterSave={(next) => setFormValues(next)}
        />
      ) : null}
    </div>
  );
}
