"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import {
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const RESEND_SUCCESS =
  "If your account is not verified yet, a new verification email has been sent.";

function CheckEmailContent() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.emailVerified === true) {
      void (async () => {
        const snapshot = await fetchPostAuthSnapshot();
        const path = resolvePostAuthRedirect({
          nextParam: searchParams.get("next"),
          intent: parseIntent(searchParams.get("intent")),
          roles: snapshot.roles,
          hasOrganizerProfile: snapshot.hasOrganizerProfile,
        });
        router.replace(path);
      })();
    }
  }, [user, loading, router, searchParams]);

  const onResend = async () => {
    if (!user?.email) return;
    setSending(true);
    setSent(false);
    try {
      await axios.post("/api/auth/resend-verification", { email: user.email });
    } catch {
      /* generic success */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  const continueToApp = async () => {
    const snapshot = await fetchPostAuthSnapshot();
    await refresh();
    const path = resolvePostAuthRedirect({
      nextParam: searchParams.get("next"),
      intent: parseIntent(searchParams.get("intent")),
      roles: snapshot.roles,
      hasOrganizerProfile: snapshot.hasOrganizerProfile,
    });
    router.push(path);
  };

  if (loading || !user) {
    return (
      <AuthPageShell>
        <p className="text-center text-sm text-muted">Loading…</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthCard
        title="Check your inbox"
        subtitle="One quick step to activate your account"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{user.email}</span>. Click
            the link in that email — it may take a minute to arrive. Check spam if you
            do not see it.
          </p>
          <p className="text-sm text-muted">
            You can explore the app now; verify your email before buying tickets.
          </p>
          {sent ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {RESEND_SUCCESS}
            </p>
          ) : null}
          <Button
            type="button"
            variant="primary"
            className="w-full"
            disabled={sending}
            onClick={() => void onResend()}
          >
            {sending ? "Sending…" : "Resend verification email"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void continueToApp()}
          >
            Continue to dashboard
          </Button>
          <p className="text-center text-sm text-muted">
            Wrong address?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in with another account
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-center text-sm text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
