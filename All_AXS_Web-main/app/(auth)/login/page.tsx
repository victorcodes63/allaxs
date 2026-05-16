"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthIntentHint } from "@/components/auth/AuthIntentHint";
import { AuthSessionEntryGate } from "@/components/auth/AuthSessionEntryGate";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { AuthLoginAuxiliary } from "@/components/auth/AuthLoginAuxiliary";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import {
  buildAuthQuery,
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";
import { useAuth } from "@/lib/auth";

const AUTH_SUBTITLE = "One account for fans and hosts.";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh: refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/auth/login", data);

      if (response.status === 200) {
        const snapshot = await fetchPostAuthSnapshot();
        await refreshAuth();
        const path = resolvePostAuthRedirect({
          nextParam: searchParams.get("next"),
          intent: parseIntent(searchParams.get("intent")),
          roles: snapshot.roles,
          hasOrganizerProfile: snapshot.hasOrganizerProfile,
        });
        router.push(path);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        "An error occurred during login";
      setError(message);
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

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              error={errors.password?.message}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
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
