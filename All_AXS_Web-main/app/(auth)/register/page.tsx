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

const AUTH_SUBTITLE = "One account for fans and hosts.";

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
      <AuthCard wide title="Create account" subtitle={AUTH_SUBTITLE}>
        <AuthSplitLayout rail={<AuthIntentHint searchParams={searchParams} basePath="/register" />}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-2.5 [&_label]:mb-0.5 [&_label]:text-xs"
          >
            {error ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {error}
              </div>
            ) : null}

            <Input
              label="Name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
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

            <Button type="submit" disabled={isSubmitting} className="mt-0.5 w-full">
              {isSubmitting ? "Creating…" : "Sign Up"}
            </Button>
          </form>

          <p className="pt-2 text-center text-[11px] text-muted sm:text-xs">
            Already have an account?{" "}
            <Link href={loginHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
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
          <p className="text-center text-sm text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <AuthSessionEntryGate title="Create account" subtitle={AUTH_SUBTITLE}>
        <RegisterForm />
      </AuthSessionEntryGate>
    </Suspense>
  );
}
