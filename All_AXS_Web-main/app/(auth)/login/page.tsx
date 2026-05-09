"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthIntentHint } from "@/components/auth/AuthIntentHint";
import { AuthSessionEntryGate } from "@/components/auth/AuthSessionEntryGate";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import {
  buildAuthQuery,
  fetchPostAuthSnapshot,
  parseIntent,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An error occurred during login";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard
        title="Sign In"
        subtitle="Enter your credentials to access your account"
      >
        <AuthIntentHint searchParams={searchParams} basePath="/login" />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
          <p className="text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
          <details className="pt-2 text-xs">
            <summary className="mx-auto inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-muted hover:border-border">
              <span
                aria-hidden
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none"
              >
                i
              </span>
              <span>Demo credentials</span>
            </summary>
            <div className="mx-auto mt-2 max-w-xs rounded-lg border border-border/50 bg-background/40 p-3 text-left text-muted">
              <p>
                Organizer: <span className="font-mono text-foreground">demo-organizer@allaxs.demo</span>
              </p>
              <p>
                Attendee: <span className="font-mono text-foreground">demo-attendee@allaxs.demo</span>
              </p>
              <p>
                Password: <span className="font-mono text-foreground">DemoFlow123!</span>
              </p>
            </div>
          </details>
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-lg text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <AuthSessionEntryGate
        title="Sign In"
        subtitle="Enter your credentials to access your account"
      >
        <LoginForm />
      </AuthSessionEntryGate>
    </Suspense>
  );
}
