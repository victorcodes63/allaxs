"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  buildAuthQuery,
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";
import { validateSignInIntentAgainstDbRoles } from "@/lib/auth/intent-access";
import axios from "axios";

/**
 * When a session already exists on entry-only routes (`/login`, `/register`),
 * send the user to the same destination they would land on after a fresh sign-in
 * (honours `next`, `intent`, organizer onboarding, etc.).
 *
 * Only runs for sessions that were already present on first load — not when the
 * user just signed in on this page (that was causing the "already signed in"
 * bounce flash before dashboard).
 */
export function useReplaceIfAuthenticated(): "checking" | "handoff" | "ready" {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  /** null until first auth settle; then whether they arrived with a session */
  const arrivedSignedInRef = useRef<boolean | null>(null);
  const [handoff, setHandoff] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (arrivedSignedInRef.current === null) {
      arrivedSignedInRef.current = !!user;
      if (!user) return;
      setHandoff(true);
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;
    if (arrivedSignedInRef.current !== true) return;

    let cancelled = false;
    void (async () => {
      try {
        const me = await axios.get("/api/auth/me");
        if (cancelled || !me.data?.user) {
          setUser(null);
          setHandoff(false);
          arrivedSignedInRef.current = false;
          return;
        }

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
        if (!cancelled) {
          setUser(null);
          setHandoff(false);
          arrivedSignedInRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router, searchParams, setUser]);

  if (loading && arrivedSignedInRef.current === null) return "checking";
  if (handoff) return "handoff";
  return "ready";
}
