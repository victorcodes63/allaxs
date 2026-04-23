"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
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
        setMessage("Invalid or missing verification token");
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
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
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
              <Link href="/login">
                <Button variant="primary" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-black/60">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
