// TODO: Fix test endpoints availability - requires ENABLE_TEST_ROUTES=true
describe.skip('Auth Refresh Token Rotation', () => {
  const testUser = {
    email: `refresh-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Refresh Test User',
  };

  beforeEach(() => {
    cy.clearAuth();
    // Seed user and wait for it to complete
    cy.seedUser(testUser.email, testUser.password, {
      name: testUser.name,
      verified: true,
    }).then((response) => {
      // Verify seed was successful
      if (response.status !== 200) {
        cy.log(`Seed failed: ${JSON.stringify(response.body)}`);
      }
      expect(response.status).to.be.oneOf([200, 201]);
    });
  });

  it('should rotate refresh token and create new session', () => {
    const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';
    
    // Ensure user is seeded first
    cy.seedUser(testUser.email, testUser.password, {
      name: testUser.name,
      verified: true,
    }).then(() => {
      // Login via backend to get tokens in response
      return cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email: testUser.email,
          password: testUser.password,
        },
        failOnStatusCode: false,
      });
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        cy.log(`Login failed: ${JSON.stringify(loginResponse.body)}`);
      }
      expect(loginResponse.status).to.eq(200);
      const initialRefreshToken = loginResponse.body.tokens?.refreshToken;
      expect(initialRefreshToken).to.be.a('string');

      // Decode initial session ID from JWT (simple base64 decode)
      const initialPayload = JSON.parse(
        atob(initialRefreshToken.split('.')[1]),
      );
      const initialSessionId = initialPayload?.sid;

      // Refresh tokens via backend
      cy.request({
        method: 'POST',
        url: `${API_URL}/auth/refresh`,
        body: { refreshToken: initialRefreshToken },
      }).then((refreshResponse) => {
        expect(refreshResponse.status).to.eq(200);
        expect(refreshResponse.body).to.have.property('tokens');
        const newRefreshToken = refreshResponse.body.tokens.refreshToken;

        // Decode new session ID
        const newPayload = JSON.parse(atob(newRefreshToken.split('.')[1]));
        const newSessionId = newPayload?.sid;

        // Session ID should be different (rotation occurred)
        expect(newSessionId).not.to.eq(initialSessionId);
      });
    });
  });

  it('should detect refresh token reuse and revoke all sessions', () => {
    const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';
    
    // Ensure user is seeded first
    cy.seedUser(testUser.email, testUser.password, {
      name: testUser.name,
      verified: true,
    }).then(() => {
      // Login via backend to get tokens in response
      return cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email: testUser.email,
          password: testUser.password,
        },
        failOnStatusCode: false,
      });
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        cy.log(`Login failed: ${JSON.stringify(loginResponse.body)}`);
      }
      expect(loginResponse.status).to.eq(200);
      const initialRefreshToken = loginResponse.body.tokens?.refreshToken;

      // First refresh (valid)
      cy.request({
        method: 'POST',
        url: `${API_URL}/auth/refresh`,
        body: { refreshToken: initialRefreshToken },
      }).then(() => {
        // Try to use the old refresh token again (reuse attack simulation)
        cy.request({
          method: 'POST',
          url: `${API_URL}/auth/refresh`,
          body: { refreshToken: initialRefreshToken },
          failOnStatusCode: false,
        }).then((reuseResponse) => {
          // Should be rejected
          expect(reuseResponse.status).to.eq(401);

          // Next protected navigation should redirect to login
          cy.visit('/dashboard');
          cy.url().should('include', '/login');
        });
      });
    });
  });
});

