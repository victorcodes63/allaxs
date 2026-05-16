"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function PaymentCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const missingReference = !reference;
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const message = missingReference
    ? "Missing payment reference."
    : (pollMessage ?? "Confirming your payment...");

  useEffect(() => {
    if (!reference) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await fetch(
          `/api/checkout/paystack/confirm?reference=${encodeURIComponent(reference)}`,
          { credentials: "same-origin" }
        );
        const data = (await res.json().catch(() => ({}))) as {
          status?: "PENDING" | "PAID";
          orderId?: string;
          message?: string;
        };

        if (!res.ok) {
          throw new Error(data.message || "Payment confirmation failed");
        }
        if (data.status === "PAID" && data.orderId) {
          const sentKey = `ticket-email-sent:${data.orderId}`;
          if (typeof window !== "undefined" && window.localStorage.getItem(sentKey) !== "true") {
            try {
              const resendRes = await fetch(`/api/checkout/orders/${data.orderId}/resend-tickets`, {
                method: "POST",
                credentials: "same-origin",
              });
              if (resendRes.ok) {
                window.localStorage.setItem(sentKey, "true");
              }
            } catch {
              // Email retries remain available from the confirmation page.
            }
          }
          router.replace(`/orders/${data.orderId}/confirmation`);
          return;
        }

        setPollMessage("Payment is processing. Waiting for confirmation...");
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        setPollMessage("Payment is still processing. Refresh this page in a few seconds.");
      }
    };

    void poll().catch((error: unknown) => {
      if (!cancelled) {
        setPollMessage(error instanceof Error ? error.message : "Payment confirmation failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <h1 className="font-display text-2xl text-foreground">Finalizing payment</h1>
      <p className="text-muted">{message}</p>
      <Link href="/tickets" className="text-primary hover:underline">
        Go to My tickets
      </Link>
    </div>
  );
}
