"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { isSentryEnabled } from "@/lib/sentry-env";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isSentryEnabled()) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-center text-sm text-muted">
          We have been notified. Try again, or return home.
        </p>
        <ErrorActions reset={reset} />
      </body>
    </html>
  );
}

function ErrorActions({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
      <a
        href="/"
        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground"
      >
        Home
      </a>
    </div>
  );
}
