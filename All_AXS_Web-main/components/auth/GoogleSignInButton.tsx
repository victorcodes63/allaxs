"use client";

import { useCallback, useMemo, useState } from "react";
import axios, { isAxiosError } from "axios";
import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import {
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";
import { useAuth } from "@/lib/auth";
import { getGoogleOAuthWebClientId } from "@/lib/google-oauth-web-client";

/** Multicolor “G” (disabled state uses parent `grayscale` + `opacity`). */
function GoogleGMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Non-interactive stand-in when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset (keeps layout parity with the live button).
 */
export function GoogleOAuthDisabledPlaceholder() {
  const devTitle =
    process.env.NODE_ENV === "development"
      ? "Google sign-in: set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local and restart the dev server."
      : "Google sign-in is not available on this site.";

  return (
    <div
      className="pointer-events-none select-none rounded-[var(--radius-card)] border border-border/80 bg-background/35 px-4 py-3 opacity-[0.48] grayscale"
      title={devTitle}
      aria-disabled="true"
      aria-label="Continue with Google is not available"
    >
      <div className="flex min-h-[42px] items-center justify-center gap-3">
        <GoogleGMark />
        <span className="text-sm font-medium text-foreground/75">Continue with Google</span>
      </div>
    </div>
  );
}

type GoogleSignInButtonProps = {
  nextParam: string | null;
  intentParam: string | null;
};

export function GoogleSignInButton({ nextParam, intentParam }: GoogleSignInButtonProps) {
  const clientId = getGoogleOAuthWebClientId();
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const intent = useMemo(() => parseIntent(intentParam), [intentParam]);

  const onSuccess = useCallback(
    async (cred: CredentialResponse) => {
      if (!cred.credential) {
        setError("Google did not return a credential.");
        return;
      }
      setError(null);
      try {
        await axios.post("/api/auth/google", { credential: cred.credential });
        const snapshot = await fetchPostAuthSnapshot();
        await refreshAuth();
        const path = resolvePostAuthRedirect({
          nextParam,
          intent,
          roles: snapshot.roles,
          hasOrganizerProfile: snapshot.hasOrganizerProfile,
        });
        router.push(path);
      } catch (err) {
        const msg = isAxiosError(err)
          ? (err.response?.data as { message?: string } | undefined)?.message
          : undefined;
        setError(msg || "Google sign-in failed. Try again or use email and password.");
      }
    },
    [intent, nextParam, refreshAuth, router],
  );

  if (!clientId) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="space-y-2">
        {error ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            {error}
          </div>
        ) : null}
        <div className="flex justify-center [&>div]:w-full">
          <GoogleLogin
            onSuccess={onSuccess}
            onError={() => setError("Google sign-in was cancelled or failed.")}
            useOneTap={false}
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
            width="100%"
          />
        </div>
        <p className="text-center text-xs text-muted">
          By continuing with Google you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">
            terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            privacy policy
          </a>
          .
        </p>
      </div>
    </GoogleOAuthProvider>
  );
}

/**
 * Google OAuth when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. Not mounted on auth/checkout pages for now; re-import where needed.
 *
 * - `oauthAfterDivider` (default): ─── or ─── then Google (e.g. after other links). Renders nothing if unset.
 * - `oauthFirst`: Real Google button when configured; otherwise a grayed non-interactive “Continue with Google” row,
 *   then the email divider (login/register keep the same layout).
 */
export function AuthGoogleSection({
  nextParam,
  intentParam,
  layout = "oauthAfterDivider",
  emailFormDividerLabel,
}: {
  nextParam: string | null;
  intentParam: string | null;
  /** @default "oauthAfterDivider" */
  layout?: "oauthAfterDivider" | "oauthFirst";
  /** When `layout` is `oauthFirst`, shown between the lines under the Google button (e.g. "Sign in with email"). */
  emailFormDividerLabel?: string;
}) {
  const configured = !!getGoogleOAuthWebClientId();

  const orRule = (
    <div className="relative flex items-center py-1">
      <div className="grow border-t border-border" />
      <span className="mx-3 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">or</span>
      <div className="grow border-t border-border" />
    </div>
  );

  if (layout === "oauthFirst") {
    const caption = emailFormDividerLabel?.trim() || "Continue with email";
    return (
      <div className="space-y-4">
        {configured ? (
          <GoogleSignInButton nextParam={nextParam} intentParam={intentParam} />
        ) : (
          <GoogleOAuthDisabledPlaceholder />
        )}
        <div className="relative flex items-center py-0.5">
          <div className="grow border-t border-border" />
          <span className="mx-3 shrink-0 text-xs font-medium tracking-wide text-muted">{caption}</span>
          <div className="grow border-t border-border" />
        </div>
      </div>
    );
  }

  if (!configured) {
    return null;
  }

  return (
    <div className="space-y-4">
      {orRule}
      <GoogleSignInButton nextParam={nextParam} intentParam={intentParam} />
    </div>
  );
}
