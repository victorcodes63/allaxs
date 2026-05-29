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
  const [failed, setFailed] = useState(false);
  const message = missingReference
    ? "We couldn't find your payment reference. If you completed payment, check your email for tickets or contact support."
    : (pollMessage ?? "Confirming your payment…");

  useEffect(() => {
    if (!reference) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
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
              const resendRes = await fetch(
                `/api/checkout/orders/${data.orderId}/resend-tickets-by-reference`,
                {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reference }),
                }
              );
              if (resendRes.ok) {
                window.localStorage.setItem(sentKey, "true");
              }
            } catch {
              // Resend remains available on the confirmation page.
            }
          }

          const refQuery = `reference=${encodeURIComponent(reference)}`;
          let confirmationPath = `/orders/${data.orderId}/confirmation?${refQuery}`;
          try {
            const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
            if (meRes.ok) {
              const meData = (await meRes.json()) as { user?: { email?: string } };
              if (meData.user?.email) {
                confirmationPath = `/dashboard/orders/${data.orderId}/confirmation?${refQuery}`;
              }
            }
          } catch {
            /* fall back to public confirmation path */
          }
          router.replace(confirmationPath);
          return;
        }

        setPollMessage("Payment received — waiting for ticket confirmation…");
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      if (!cancelled) {
        setFailed(true);
        setPollMessage(
          "Payment is taking longer than usual. Your tickets will be emailed once confirmation completes — refresh this page or check your inbox in a few minutes."
        );
      }
    };

    void poll().catch((error: unknown) => {
      if (!cancelled) {
        setFailed(true);
        setPollMessage(error instanceof Error ? error.message : "Payment confirmation failed");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  return (
    <div className="max-w-lg mx-auto py-20 text-center space-y-4">
      <h1 className="font-display text-2xl text-foreground">
        {failed ? "Almost there" : "Finalizing payment"}
      </h1>
      <p className="text-muted leading-relaxed">{message}</p>
      {failed && reference ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[var(--btn-min-h)] items-center justify-center rounded-[var(--radius-button)] bg-primary px-4 text-sm font-semibold text-white shadow-[var(--btn-shadow-primary)] transition-opacity hover:opacity-92"
        >
          Refresh status
        </button>
      ) : null}
      <p className="text-sm text-muted">
        Tickets are emailed as a PDF with QR codes.{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>{" "}
        with the same email to view them in My tickets.
      </p>
    </div>
  );
}
