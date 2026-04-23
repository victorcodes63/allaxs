"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // Redirect to dashboard or the next parameter
        const next = searchParams.get("next") || "/dashboard";
        router.push(next);
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
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <AuthCard
        title="Sign In"
        subtitle="Enter your credentials to access your account"
      >
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
          <p className="text-sm text-black/60">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </AuthCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
