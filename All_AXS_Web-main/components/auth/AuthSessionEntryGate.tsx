"use client";

import type { ReactNode } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { useReplaceIfAuthenticated } from "@/lib/auth/use-replace-if-authenticated";

/**
 * Hides sign-in / sign-up forms while we resolve an existing session, then replaces
 * the route so signed-in users never see a redundant auth form.
 */
export function AuthSessionEntryGate({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const gate = useReplaceIfAuthenticated();

  if (gate !== "ready") {
    return (
      <AuthPageShell>
        <AuthCard title={title} subtitle={subtitle}>
          <p className="mx-auto max-w-sm text-center text-sm leading-relaxed text-muted">
            {gate === "checking"
              ? "Checking your session…"
              : "You're already signed in. Taking you to the right place…"}
          </p>
        </AuthCard>
      </AuthPageShell>
    );
  }

  return <>{children}</>;
}
