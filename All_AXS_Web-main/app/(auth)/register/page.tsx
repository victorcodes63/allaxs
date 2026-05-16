"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthIntentHint } from "@/components/auth/AuthIntentHint";
import { AuthSessionEntryGate } from "@/components/auth/AuthSessionEntryGate";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
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

function registerCardSubtitle(): string {
  return "One account for fans and hosts. Switch views anytime from the hub bar—no need to sign out again.";
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh: refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loginHref = `/login${buildAuthQuery({
    next: searchParams.get("next"),
    intent: parseIntent(searchParams.get("intent")),
  })}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: RegisterInput) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/auth/register", data);

      if (response.status === 200 || response.status === 201) {
        const snapshot = await fetchPostAuthSnapshot();
        // Push the new user into the shared <AuthProvider> so the
        // chrome and role-aware redirects react immediately.
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
        "An error occurred during registration";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard wide title="Create an Account" subtitle={registerCardSubtitle()}>
        <AuthSplitLayout
          rail={<AuthIntentHint searchParams={searchParams} basePath="/register" />}
        >
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Account</p>
              <h2 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
                Your details
              </h2>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border/50 bg-background/30 p-5 sm:p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                    {error}
                  </div>
                )}

                <Input
                  label="Name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  {...register("name")}
                  error={errors.name?.message}
                />

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
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register("password")}
                  error={errors.password?.message}
                />

                <Button type="submit" disabled={isSubmitting} className="mt-1">
                  {isSubmitting ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted">
                Already have an account?{" "}
                <Link href={loginHref} className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </AuthSplitLayout>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-lg text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <AuthSessionEntryGate title="Create an Account" subtitle={registerCardSubtitle()}>
        <RegisterForm />
      </AuthSessionEntryGate>
    </Suspense>
  );
}
