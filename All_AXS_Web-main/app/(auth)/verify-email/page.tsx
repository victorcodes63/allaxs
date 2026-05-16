"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import axios from "axios";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage(
          "Invalid or missing verification token. You can request a new verification email."
        );
        return;
      }

      try {
        const response = await axios.post("/api/auth/verify-email", { token });

        if (response.status === 200) {
          setStatus("success");
          setMessage("Email verified successfully! You can now log in.");
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push("/login");
          }, 3000);
        }
      } catch (err) {
        setStatus("error");
        const errorMessage =
          (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          "An error occurred while verifying your email";
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <AuthPageShell>
      <AuthCard
        title="Email Verification"
        subtitle={
          status === "loading"
            ? "Verifying your email..."
            : status === "success"
            ? "Verification Successful"
            : "Verification Failed"
        }
      >
        <div className="space-y-4">
          {status === "loading" && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
                {message}
              </div>
              <p className="text-sm text-black/60 text-center">
                Redirecting to login page...
              </p>
              <Link href="/login">
                <Button variant="primary" className="w-full">
                  Continue to Sign In
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-4 text-sm">
                {message}
              </div>
              <Link href="/resend-verification">
                <Button variant="primary" className="w-full">
                  Resend Verification Email
                </Button>
              </Link>
              <Link href="/login" className="block text-center text-sm text-primary hover:underline">
                Back to Sign In
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-lg text-muted">Loading…</p>
        </AuthPageShell>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
