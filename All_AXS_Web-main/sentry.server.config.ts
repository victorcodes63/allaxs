import * as Sentry from "@sentry/nextjs";
import { getSentryDsn } from "@/lib/sentry-env";

const dsn = getSentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  sendDefaultPii: false,
});
