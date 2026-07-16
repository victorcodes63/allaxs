"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  buildAuthQuery,
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";
import { validateSignInIntentAgainstDbRoles } from "@/lib/auth/intent-access";

/**
 * When a session already exists on entry-only routes (`/login`, `/register`),
 * send the user to the same destination they would land on after a fresh sign-in
 * (honours `next`, `intent`, organizer onboarding, etc.).
 */
export function useReplaceIfAuthenticated(): "checking" | "handoff" | "ready" {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const intent = parseIntent(searchParams.get("intent")) ?? "attend";
        const snapshot = await fetchPostAuthSnapshot();
        if (cancelled) return;

        const roleCheck = validateSignInIntentAgainstDbRoles(intent, snapshot.roles);
        if (!roleCheck.ok) {
          if (roleCheck.code === "noHostAccount") {
            router.replace("/dashboard?notice=noHostAccount");
          } else {
            router.replace(
              `/login${buildAuthQuery({
                next: searchParams.get("next"),
                intent,
              })}&error=noFanAccount`,
            );
          }
          return;
        }

        const path = resolvePostAuthRedirect({
          nextParam: searchParams.get("next"),
          intent,
          roles: snapshot.roles,
          hasOrganizerProfile: snapshot.hasOrganizerProfile,
        });
        router.replace(path);
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router, searchParams]);

  if (loading) return "checking";
  if (user) return "handoff";
  return "ready";
}
