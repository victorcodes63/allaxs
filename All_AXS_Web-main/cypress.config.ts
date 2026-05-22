import { defineConfig } from 'cypress';

/**
 * E2E environment (see README § Testing):
 *
 * - WEB_BASE_URL — Next.js app under test (default http://localhost:3000).
 *   Start with `npm run dev` before `npm run cypress` or `npm run cypress:run`.
 *
 * - API_URL — Nest API for cy.seedUser / cy.getLatestTokens helpers in
 *   auth-e2e.cy.ts (default http://localhost:8080). Not required for stubbed
 *   specs such as auth-email-flows.cy.ts, forgot-password.cy.ts, verify-email.cy.ts.
 *
 * Stubbed auth-email specs intercept `/api/auth/*` in the browser; no Resend key
 * or ENABLE_TEST_ROUTES needed.
 */
export default defineConfig({
  e2e: {
    /** Default Cypress width (1000) is below Tailwind `lg` (1024), so desktop nav stays hidden. */
    viewportWidth: 1280,
    viewportHeight: 800,
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    env: {
      API_URL: process.env.API_URL || 'http://localhost:8080',
    },
  },
});

