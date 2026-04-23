// ***********************************************
// Custom Cypress commands
// ***********************************************

const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';

/**
 * Login via API route handler (sets httpOnly cookies)
 */
Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
    failOnStatusCode: false,
  });
});

/**
 * Register via API route handler (sets httpOnly cookies)
 */
Cypress.Commands.add(
  'apiRegister',
  (email: string, password: string, name: string) => {
    return cy.request({
      method: 'POST',
      url: '/api/auth/register',
      body: { email, password, name },
      failOnStatusCode: false,
    });
  },
);

/**
 * Clear authentication (cookies and localStorage)
 */
Cypress.Commands.add('clearAuth', () => {
  cy.clearCookies();
  cy.clearLocalStorage();
});

/**
 * Seed a test user via backend test endpoint
 */
Cypress.Commands.add(
  'seedUser',
  (
    email: string,
    password: string,
    options?: { name?: string; roles?: string[]; verified?: boolean },
  ) => {
    return cy.request({
      method: 'POST',
      url: `${API_URL}/__test__/seed-user`,
      body: {
        email,
        password,
        name: options?.name || 'Test User',
        roles: options?.roles || ['ATTENDEE'],
        verified: options?.verified || false,
      },
      failOnStatusCode: false,
    });
  },
);

/**
 * Get latest tokens for a user (for email verification and password reset)
 */
Cypress.Commands.add('getLatestTokens', (email: string) => {
  return cy.request({
    method: 'GET',
    url: `${API_URL}/__test__/latest-tokens`,
    qs: { email },
    failOnStatusCode: false,
  });
});

/**
 * Get latest audit log entry
 */
Cypress.Commands.add('getLatestAuditLog', () => {
  return cy.request({
    method: 'GET',
    url: `${API_URL}/__test__/audit-latest`,
    failOnStatusCode: false,
  });
});

export {};

