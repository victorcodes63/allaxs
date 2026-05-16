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

function loginCardSubtitle(): string {
  return "One account for fans and hosts. Switch views anytime from the hub bar—no need to sign out again.";
}

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
        // Propagate the freshly-signed-in user into the shared
        // <AuthProvider> so the chrome (sidebar, top bar, role guards)
        // updates before we navigate. Without this the provider would
        // still hold its initial null state until something else
        // triggered a refresh.
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
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An error occurred during login";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard wide title="Sign In" subtitle={loginCardSubtitle()}>
        <AuthSplitLayout
          rail={<AuthIntentHint searchParams={searchParams} basePath="/login" />}
        >
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Account</p>
              <h2 className="mt-1 font-display text-base font-semibold tracking-tight text-foreground">
                Email &amp; password
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

                <Button type="submit" disabled={isSubmitting} className="mt-1">
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </div>

            <div className="space-y-3 text-center">
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
              <p className="text-sm text-muted">
                Didn&apos;t receive a verification email?{" "}
                <Link href="/resend-verification" className="font-medium text-primary hover:underline">
                  Resend verification
                </Link>
              </p>
              <p className="text-sm text-muted">
                Don&apos;t have an account?{" "}
                <Link href={registerHref} className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
              <details className="border-t border-border/40 pt-4 text-xs">
                <summary className="mx-auto inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-muted transition-colors hover:border-border hover:text-foreground/80">
                  <span
                    aria-hidden
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none"
                  >
                    i
                  </span>
                  <span>Demo credentials</span>
                </summary>
                <div className="mx-auto mt-3 max-w-xs rounded-lg border border-border/50 bg-background/40 p-3 text-left text-muted">
                  <p>
                    Organizer: <span className="font-mono text-foreground">demo-organizer@allaxs.demo</span>
                  </p>
                  <p>
                    Attendee: <span className="font-mono text-foreground">demo-attendee@allaxs.demo</span>
                  </p>
                  <p>
                    Admin: <span className="font-mono text-foreground">demo-admin@allaxs.demo</span>
                  </p>
                  <p>
                    Password: <span className="font-mono text-foreground">DemoFlow123!</span>
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed">
                    The organizer account is both a fan and a host: sign-in lands on the host
                    workspace. Use{" "}
                    <span className="font-mono text-foreground">Attendee view</span> in the hub bar
                    (or <span className="font-mono text-foreground">/login?intent=attend</span>) for fan
                    home without signing out again.
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed">
                    Admins land on <span className="font-mono text-foreground">/admin</span>. Open{" "}
                    <span className="font-mono text-foreground">/admin/moderation</span> to action submissions.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </AuthSplitLayout>
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
      <AuthSessionEntryGate title="Sign In" subtitle={loginCardSubtitle()}>
        <LoginForm />
      </AuthSessionEntryGate>
    </Suspense>
  );
}
