/** Shared Sentry DSN resolution (server, edge, and client). */
export function getSentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}
