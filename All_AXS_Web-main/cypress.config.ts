import { defineConfig } from 'cypress';

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

