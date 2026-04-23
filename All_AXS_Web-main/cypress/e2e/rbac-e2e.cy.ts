// TODO: Fix test endpoints availability - requires ENABLE_TEST_ROUTES=true
describe.skip('RBAC E2E - Role-Based Access Control', () => {
  const testUsers = {
    admin: {
      email: `admin-${Date.now()}@example.com`,
      password: 'Admin123!',
      name: 'Admin User',
    },
    organizer: {
      email: `organizer-${Date.now()}@example.com`,
      password: 'Organizer123!',
      name: 'Organizer User',
    },
    attendee: {
      email: `attendee-${Date.now()}@example.com`,
      password: 'Attendee123!',
      name: 'Attendee User',
    },
  };

  beforeEach(() => {
    cy.clearAuth();
  });

  it('should allow admin to access admin endpoints', () => {
    const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';
    
    // Seed admin user
    cy.seedUser(testUsers.admin.email, testUsers.admin.password, {
      name: testUsers.admin.name,
      roles: ['ADMIN'],
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status !== 200) {
        cy.log(`Seed failed: ${JSON.stringify(seedResponse.body)}`);
      }
      // Login as admin via backend to get tokens
      return cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email: testUsers.admin.email,
          password: testUsers.admin.password,
        },
        failOnStatusCode: false,
      });
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        cy.log(`Login failed: ${JSON.stringify(loginResponse.body)}`);
      }
      expect(loginResponse.status).to.eq(200);
      const accessToken = loginResponse.body.tokens?.accessToken;
      expect(accessToken).to.be.a('string');

      // Call admin endpoint via backend API
      cy.request({
        method: 'GET',
        url: `${API_URL}/admin/ping`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).then((adminResponse) => {
        expect(adminResponse.status).to.eq(200);
        expect(adminResponse.body).to.have.property('message');
        expect(adminResponse.body.admin).to.eq(testUsers.admin.email);
      });
    });
  });

  it('should reject non-admin from admin endpoints', () => {
    const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';
    
    // Seed attendee user
    cy.seedUser(testUsers.attendee.email, testUsers.attendee.password, {
      name: testUsers.attendee.name,
      roles: ['ATTENDEE'],
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status !== 200) {
        cy.log(`Seed failed: ${JSON.stringify(seedResponse.body)}`);
      }
      // Login as attendee via backend to get tokens
      return cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email: testUsers.attendee.email,
          password: testUsers.attendee.password,
        },
        failOnStatusCode: false,
      });
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        cy.log(`Login failed: ${JSON.stringify(loginResponse.body)}`);
      }
      expect(loginResponse.status).to.eq(200);
      const accessToken = loginResponse.body.tokens?.accessToken;
      expect(accessToken).to.be.a('string');

      // Try to call admin endpoint
      cy.request({
        method: 'GET',
        url: `${API_URL}/admin/ping`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        failOnStatusCode: false,
      }).then((adminResponse) => {
        expect(adminResponse.status).to.eq(403);
      });
    });
  });

  it('should create audit log entry for admin actions', () => {
    const API_URL = Cypress.env('API_URL') || 'http://localhost:8080';
    
    // Seed admin user
    cy.seedUser(testUsers.admin.email, testUsers.admin.password, {
      name: testUsers.admin.name,
      roles: ['ADMIN'],
      verified: true,
    }).then((seedResponse) => {
      if (seedResponse.status !== 200) {
        cy.log(`Seed failed: ${JSON.stringify(seedResponse.body)}`);
      }
      // Login as admin via backend to get tokens
      return cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email: testUsers.admin.email,
          password: testUsers.admin.password,
        },
        failOnStatusCode: false,
      });
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        cy.log(`Login failed: ${JSON.stringify(loginResponse.body)}`);
      }
      expect(loginResponse.status).to.eq(200);
      const accessToken = loginResponse.body.tokens?.accessToken;
      expect(accessToken).to.be.a('string');

      // Perform admin action
      cy.request({
        method: 'GET',
        url: `${API_URL}/admin/ping`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).then(() => {
        // Wait a bit for async audit logging
        cy.wait(200);

        // Get latest audit log
        cy.getLatestAuditLog().then((auditResponse) => {
          expect(auditResponse.status).to.eq(200);
          const body = auditResponse.body as {
            action: string;
            resourceType: string;
            status: string;
          };
          expect(body).to.have.property('action');
          expect(body.action).to.eq('ADMIN_PING');
          expect(body.resourceType).to.eq('system');
          expect(body.status).to.eq('SUCCESS');
        });
      });
    });
  });

  it('should allow organizer to access organizer onboarding', () => {
    // Seed organizer user
    cy.seedUser(testUsers.organizer.email, testUsers.organizer.password, {
      name: testUsers.organizer.name,
      roles: ['ORGANIZER'],
      verified: true,
    }).then(() => {
      // Login as organizer via frontend API (sets cookies)
      cy.apiLogin(testUsers.organizer.email, testUsers.organizer.password).then(
        (loginResponse) => {
          expect(loginResponse.status).to.eq(200);
          
          // Wait for cookies to be set
          cy.wait(100);
          
          // Visit organizer onboarding (should be accessible)
          cy.visit('/organizer/onboarding', { failOnStatusCode: false });
          cy.url().should('include', '/organizer/onboarding');
          cy.get('body').should('be.visible');
        },
      );
    });
  });
});

