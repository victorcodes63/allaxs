"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import axios from "axios";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      
      if (response.status === 200) {
        // Auto-login after registration, redirect to dashboard
        router.push("/dashboard");
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || "An error occurred during registration";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <AuthCard
        title="Create an Account"
        subtitle="Sign up to get started"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 text-sm">
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-black/60">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </AuthCard>
    </div>
  );
}
