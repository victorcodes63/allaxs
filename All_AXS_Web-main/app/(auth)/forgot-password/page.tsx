"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/auth/forgot-password", data);

      if (response.status === 200) {
        setSuccess(true);
      }
    } catch {
      // Even on error, show success message for security
      setSuccess(true);
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

          <Button type="submit" disabled={isSubmitting}>
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
