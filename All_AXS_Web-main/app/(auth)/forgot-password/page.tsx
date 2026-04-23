"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
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
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <AuthCard
        title="Forgot Password"
        subtitle="Enter your email to receive a password reset link"
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

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}

        {!success && (
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        )}
      </AuthCard>
    </div>
  );
}
