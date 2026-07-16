"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";
import { TurnstileField, getTurnstileSiteKey } from "@/components/auth/TurnstileField";
import { captchaErrorMessage, isCaptchaErrorCode } from "@/lib/auth/captcha-errors";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const turnstileRequired = !!getTurnstileSiteKey();

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: prefilledEmail },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setError(null);
    setSuccess(false);

    if (turnstileRequired && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/auth/forgot-password", {
        ...data,
        turnstileToken,
      });

      if (response.status === 200) {
        setSuccess(true);
      }
    } catch (err) {
      const responseData = (err as { response?: { data?: { message?: string; code?: string } } })
        .response?.data;
      if (isCaptchaErrorCode(responseData?.code)) {
        setError(captchaErrorMessage(responseData?.code, responseData?.message));
        setTurnstileToken(null);
        setTurnstileReset((n) => n + 1);
      } else {
        setSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title={prefilledEmail ? "Set a password" : "Forgot Password"}
      subtitle={
        prefilledEmail
          ? "We'll email you a link to set a password for your account"
          : "Enter your email to receive a password reset link"
      }
    >
      {success ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
            If an account exists, a password reset email has been sent.
          </div>
          <Link href="/login">
            <Button variant="primary">Back to Sign In</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error ? (
            <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
              {error}
            </div>
          ) : null}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            error={errors.email?.message}
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
          >
            {isSubmitting ? "Sending..." : prefilledEmail ? "Send set-password link" : "Send Reset Link"}
          </Button>
        </form>
      )}

      {!success ? (
        <div className="text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Back to Sign In
          </Link>
        </div>
      ) : null}
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <Suspense
        fallback={
          <AuthCard title="Forgot Password" subtitle="Loading…">
            <p className="text-sm text-muted">Loading…</p>
          </AuthCard>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
