"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useCallback } from "react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthIntentHint } from "@/components/auth/AuthIntentHint";
import { AuthSessionEntryGate } from "@/components/auth/AuthSessionEntryGate";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { AuthLoginAuxiliary } from "@/components/auth/AuthLoginAuxiliary";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import {
  buildAuthQuery,
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
  type AuthIntent,
} from "@/lib/auth/post-auth-redirect";
import { validateSignInIntentAgainstDbRoles } from "@/lib/auth/intent-access";
import { TurnstileField, getTurnstileSiteKey } from "@/components/auth/TurnstileField";
import { captchaErrorMessage, isCaptchaErrorCode } from "@/lib/auth/captcha-errors";
import { useAuth } from "@/lib/auth";

const AUTH_SUBTITLE = "One account for fans and hosts.";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh: refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(() => {
    if (searchParams.get("session") === "expired") {
      return "Your session expired. Please sign in again.";
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const turnstileRequired = !!getTurnstileSiteKey();
  const registerHref = `/register${buildAuthQuery({
    next: searchParams.get("next"),
    intent: parseIntent(searchParams.get("intent")),
  })}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const onSubmit = async (data: LoginInput) => {
    setError(null);

    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setIsSubmitting(true);

    const intent: AuthIntent = parseIntent(searchParams.get("intent")) ?? "attend";

    try {
      const response = await axios.post("/api/auth/login", {
        ...data,
        intent,
        turnstileToken,
      });

      if (response.status === 200) {
        await refreshAuth();
        const snapshot = await fetchPostAuthSnapshot();
        const roleCheck = validateSignInIntentAgainstDbRoles(intent, snapshot.roles);
        if (!roleCheck.ok) {
          await axios.post("/api/auth/logout").catch(() => undefined);
          setError(roleCheck.message);
          return;
        }
        const path = resolvePostAuthRedirect({
          nextParam: searchParams.get("next"),
          intent,
          roles: snapshot.roles,
          hasOrganizerProfile: snapshot.hasOrganizerProfile,
        });
        router.push(path);
      }
    } catch (err) {
      const responseData = (err as { response?: { data?: { message?: string; code?: string } } })
        .response?.data;
      let message = responseData?.message || "An error occurred during login";
      if (isCaptchaErrorCode(responseData?.code)) {
        message = captchaErrorMessage(responseData?.code, message);
      } else if (responseData?.code === "noHostAccount") {
        message =
          "No host account exists for the email address provided. Use the Fan tab for tickets, or sign up as a host to create an organizer account.";
      } else if (responseData?.code === "noFanAccount") {
        message =
          "No fan account exists for the email address provided. Use the Host tab if you are an organizer.";
      } else if (responseData?.code === "emailNotVerified") {
        message =
          "Please verify your email before signing in. Check your inbox or resend the verification link.";
      }
      setError(message);
      if (isCaptchaErrorCode(responseData?.code)) {
        setTurnstileReset((n) => n + 1);
      }
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard wide title="Sign In" subtitle={AUTH_SUBTITLE}>
        <AuthSplitLayout rail={<AuthIntentHint searchParams={searchParams} basePath="/login" />}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-3 [&_label]:mb-0.5 [&_label]:text-xs"
          >
            {error ? <AuthErrorBanner message={error} /> : null}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
              error={errors.email?.message}
            />

            <PasswordInput
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              error={errors.password?.message}
            />

            <TurnstileField
              onToken={onTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
              resetSignal={turnstileReset}
            />

            <Button
              type="submit"
              disabled={isSubmitting || (turnstileRequired && !turnstileToken)}
              className="w-full"
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <AuthLoginAuxiliary registerHref={registerHref} />
        </AuthSplitLayout>
      </AuthCard>
    </AuthPageShell>
  );
}

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
      {message}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-center text-sm text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <AuthSessionEntryGate title="Sign In" subtitle={AUTH_SUBTITLE}>
        <LoginForm />
      </AuthSessionEntryGate>
    </Suspense>
  );
}
