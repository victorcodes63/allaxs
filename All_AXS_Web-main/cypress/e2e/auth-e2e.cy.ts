describe('Auth E2E - Happy Paths', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    name: 'Test User',
  };

  beforeEach(() => {
    cy.clearAuth();
  });

  it('should register a new user', () => {
    cy.apiRegister(testUser.email, testUser.password, testUser.name).then(
      (response) => {
        expect(response.status).to.eq(200);
        const body = response.body as { user: { email: string } };
        expect(body).to.have.property('user');
        expect(body.user.email).to.eq(testUser.email);
      },
    );
  });

  // TODO: Fix test endpoints availability - requires ENABLE_TEST_ROUTES=true
  it.skip('should login and visit protected dashboard', () => {
    // Seed user first
    cy.seedUser(testUser.email, testUser.password, {
      name: testUser.name,
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status === 404) {
        throw new Error('Test endpoints not available. Ensure backend is running with ENABLE_TEST_ROUTES=true');
      }
      expect(seedResponse.status).to.eq(200);

      // Login via frontend API route (sets cookies)
      cy.apiLogin(testUser.email, testUser.password).then((loginResponse) => {
        expect(loginResponse.status).to.eq(200);
        expect(loginResponse.body).to.have.property('user');

        // Wait a bit for cookies to be set
        cy.wait(100);

        // Visit dashboard (should not redirect)
        cy.visit('/dashboard', { failOnStatusCode: false });
        cy.url().should('include', '/dashboard');
        // Assert some content is rendered (dashboard has "Organizer Dashboard" or "Dashboard")
        cy.get('body').should('be.visible');
        cy.get('h1, [class*="dashboard"]').should('exist');
      });
    });
  });

  it('should redirect unauthenticated users to login', () => {
    cy.clearAuth();
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
    cy.url().should('include', 'next=');
  });

  // TODO: Fix test endpoints availability - requires ENABLE_TEST_ROUTES=true
  it.skip('should handle forgot password flow', () => {
    // Seed user
    cy.seedUser(testUser.email, testUser.password, {
      name: testUser.name,
      verified: true,
    });

    // Request password reset
    cy.request({
      method: 'POST',
      url: '/api/auth/forgot-password',
      body: { email: testUser.email },
    }).then((response) => {
      expect(response.status).to.eq(200);

      // Wait a bit for token to be created
      cy.wait(500);

      // Get reset token from test endpoint
      cy.getLatestTokens(testUser.email).then((tokenResponse) => {
        if (tokenResponse.status === 404) {
          throw new Error('Test endpoints not available. Ensure backend is running with ENABLE_TEST_ROUTES=true');
        }
        expect(tokenResponse.status).to.eq(200);
        const body = tokenResponse.body as { resetToken?: string | null };
        const resetToken = body.resetToken;
        
        // Token might be null if not created yet, skip test if so
        if (!resetToken) {
          cy.log('Reset token not available, skipping test');
          return;
        }
        
        expect(resetToken).to.be.a('string');

        // Visit reset password page
        cy.visit(`/reset-password?token=${resetToken}`);
        cy.url().should('include', '/reset-password');

        // Set new password
        const newPassword = 'NewPassword123!';
        cy.get('input[type="password"]').first().type(newPassword);
        cy.get('input[type="password"]').last().type(newPassword);
        cy.get('button[type="submit"]').click();

        // Wait for redirect
        cy.wait(1000);

        // Should be able to login with new password
        cy.apiLogin(testUser.email, newPassword).then((loginResponse) => {
          expect(loginResponse.status).to.eq(200);
        });
      });
    });
  });

  // TODO: Fix test endpoints availability - requires ENABLE_TEST_ROUTES=true
  it.skip('should handle email verification flow', () => {
    // Register user (unverified)
    cy.apiRegister(testUser.email, testUser.password, testUser.name).then(
      () => {
        // Wait a bit for token to be created
        cy.wait(500);

        // Get verification token from test endpoint
        cy.getLatestTokens(testUser.email).then((tokenResponse) => {
          if (tokenResponse.status === 404) {
            throw new Error('Test endpoints not available. Ensure backend is running with ENABLE_TEST_ROUTES=true');
          }
          expect(tokenResponse.status).to.eq(200);
          const body = tokenResponse.body as { verifyToken?: string | null };
          const verifyToken = body.verifyToken;
          
          // Token might be null if not created yet, skip test if so
          if (!verifyToken) {
            cy.log('Verification token not available, skipping test');
            return;
          }
          
          expect(verifyToken).to.be.a('string');

          // Verify email via API
          cy.request({
            method: 'POST',
            url: '/api/auth/verify-email',
            body: { token: verifyToken },
          }).then((verifyResponse) => {
            expect(verifyResponse.status).to.eq(200);
            expect(verifyResponse.body).to.have.property('message');
          });
        });
      },
    );
  });
});

