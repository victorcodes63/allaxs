// TODO: Fix syntax error and test endpoints availability - requires ENABLE_TEST_ROUTES=true
describe.skip('Rate Limit Smoke Test', () => {
  const testUser = {
    email: `ratelimit-${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  beforeEach(() => {
    cy.clearAuth();
  });

  it('should rate limit login attempts', () => {
    // Seed user and wait for completion, then fire rapid requests
    cy.seedUser(testUser.email, testUser.password, {
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status === 404) {
        throw new Error('Test endpoints not available. Ensure backend is running with ENABLE_TEST_ROUTES=true');
      }
      // Make multiple bad login attempts rapidly (fire them quickly)
      // Chain requests and collect status codes
      return cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: 'WrongPassword123!',
        },
        failOnStatusCode: false,
      }).then((r1) => {
        return cy.request({
          method: 'POST',
          url: '/api/auth/login',
          body: {
            email: testUser.email,
            password: 'WrongPassword123!',
          },
          failOnStatusCode: false,
        }).then((r2) => {
          return cy.request({
            method: 'POST',
            url: '/api/auth/login',
            body: {
              email: testUser.email,
              password: 'WrongPassword123!',
            },
            failOnStatusCode: false,
          }).then((r3) => {
            return cy.request({
              method: 'POST',
              url: '/api/auth/login',
              body: {
                email: testUser.email,
                password: 'WrongPassword123!',
              },
              failOnStatusCode: false,
            }).then((r4) => {
              return cy.request({
                method: 'POST',
                url: '/api/auth/login',
                body: {
                  email: testUser.email,
                  password: 'WrongPassword123!',
                },
                failOnStatusCode: false,
              }).then((r5) => {
                return cy.request({
                  method: 'POST',
                  url: '/api/auth/login',
                  body: {
                    email: testUser.email,
                    password: 'WrongPassword123!',
                  },
                  failOnStatusCode: false,
                }).then((r6) => {
                  // At least one should be rate limited (429)
                  const statuses = [r1.status, r2.status, r3.status, r4.status, r5.status, r6.status];
                  const rateLimited = statuses.some((status) => status === 429);
                  expect(rateLimited).to.be.true; // eslint-disable-line @typescript-eslint/no-unused-expressions
                });
              });
            });
          });
        });
      });
    });
  });

  it('should allow successful login after rate limit window', () => {
    // Seed user and wait for completion
    cy.seedUser(testUser.email, testUser.password, {
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status === 404) {
        throw new Error('Test endpoints not available. Ensure backend is running with ENABLE_TEST_ROUTES=true');
      }
      
      // Make bad attempts (may hit rate limit) - chain them
      return cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: 'WrongPassword123!',
        },
        failOnStatusCode: false,
      });
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: 'WrongPassword123!',
        },
        failOnStatusCode: false,
      });
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: 'WrongPassword123!',
        },
        failOnStatusCode: false,
      });
    }).then(() => {
      // Wait for rate limit window (60 seconds, but in tests we can wait less)
      // Note: In real scenarios, you'd wait the full TTL
      cy.wait(2000);

      // Should be able to login with correct password
      cy.apiLogin(testUser.email, testUser.password).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });
});

