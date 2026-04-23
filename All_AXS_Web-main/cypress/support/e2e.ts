// ***********************************************************
// This support file is loaded before all test files.
// You can add global configuration, custom commands, etc.
// ***********************************************************

// Import Cypress commands
import './commands';

// Prevent TypeScript errors on custom commands
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      apiLogin(
        email: string,
        password: string,
      ): Chainable<Cypress.Response<unknown>>;
      apiRegister(
        email: string,
        password: string,
        name: string,
      ): Chainable<Cypress.Response<unknown>>;
      clearAuth(): Chainable<void>;
      seedUser(
        email: string,
        password: string,
        options?: { name?: string; roles?: string[]; verified?: boolean },
      ): Chainable<Cypress.Response<unknown>>;
      getLatestTokens(email: string): Chainable<Cypress.Response<unknown>>;
      getLatestAuditLog(): Chainable<Cypress.Response<unknown>>;
    }
  }
}

