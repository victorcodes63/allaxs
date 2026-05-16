#!/usr/bin/env node
/**
 * Fails the build when production/staging env would ship demo catalog or localhost API.
 *
 * Enforced when:
 *   - VERCEL_ENV=production (Vercel Production deploy), or
 *   - ENFORCE_PRODUCTION_ENV=true (GitHub Actions on main), or
 *   - CI=true and NODE_ENV=production
 *
 * Skip locally: do not set ENFORCE_PRODUCTION_ENV (default npm run build on laptop is lenient).
 */

const enforced =
  process.env.VERCEL_ENV === "production" ||
  process.env.ENFORCE_PRODUCTION_ENV === "true" ||
  (process.env.CI === "true" && process.env.NODE_ENV === "production");

if (!enforced) {
  process.exit(0);
}

const errors = [];

function env(name) {
  return (process.env[name] ?? "").trim();
}

if (env("NEXT_PUBLIC_USE_DEMO_EVENTS") === "true") {
  errors.push(
    "NEXT_PUBLIC_USE_DEMO_EVENTS=true is forbidden in production. Set false or omit and use the API catalog.",
  );
}

if (env("NEXT_PUBLIC_USE_API_CHECKOUT") !== "true") {
  errors.push(
    "NEXT_PUBLIC_USE_API_CHECKOUT must be true in production (Paystack + persisted orders).",
  );
}

for (const key of ["API_URL", "NEXT_PUBLIC_API_BASE_URL"]) {
  const value = env(key);
  if (!value) {
    errors.push(`${key} is required in production.`);
    continue;
  }
  if (/localhost|127\.0\.0\.1/i.test(value)) {
    errors.push(`${key} must not point at localhost in production (got ${value}).`);
  }
}

const siteUrl = env("NEXT_PUBLIC_SITE_URL") || env("NEXT_PUBLIC_BASE_URL");
if (!siteUrl) {
  errors.push("NEXT_PUBLIC_SITE_URL (or NEXT_PUBLIC_BASE_URL) is required in production.");
} else if (!/^https:\/\//i.test(siteUrl)) {
  errors.push(`NEXT_PUBLIC_SITE_URL must be HTTPS in production (got ${siteUrl}).`);
}

if (errors.length > 0) {
  console.error("\n[validate-production-env] Production environment check failed:\n");
  for (const message of errors) {
    console.error(`  • ${message}`);
  }
  console.error(
    "\nSee docs/PHASE0_GO_LIVE.md and docs/STAGING_CHECKLIST.md for the Vercel variable matrix.\n",
  );
  process.exit(1);
}

console.log("[validate-production-env] OK — production env variables look valid.");
