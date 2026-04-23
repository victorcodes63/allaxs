"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid or missing reset token");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });

      if (response.status === 200) {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        "An error occurred while resetting your password";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell>
        <AuthCard
          title="Password Reset Successful"
          subtitle="Your password has been reset successfully"
        >
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
              Password reset successfully. You can now log in with your new
              password.
            </div>
            <p className="text-sm text-black/60 text-center">
              Redirecting to login page...
            </p>
            <Link href="/login">
              <Button variant="primary" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </AuthCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthCard
        title="Reset Password"
        subtitle="Enter your new password"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("newPassword")}
            error={errors.newPassword?.message}
            disabled={!token}
          />

          <Input
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("confirmNewPassword")}
            error={errors.confirmNewPassword?.message}
            disabled={!token}
          />

          <Button type="submit" disabled={isSubmitting || !token}>
            {isSubmitting ? "Resetting password..." : "Reset Password"}
          </Button>
        </form>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-lg text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
