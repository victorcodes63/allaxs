describe('Organizer Onboarding', () => {
  beforeEach(() => {
    // Mock the /api/auth/me endpoint to return a logged-in user
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 200,
      body: {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      },
    }).as('getMe');
    
    // Intercept API calls
    cy.intercept('GET', '/api/organizer/profile', {
      statusCode: 404,
      body: { message: 'Profile not found' },
    }).as('getProfile');

    cy.intercept('POST', '/api/organizer/profile', {
      statusCode: 200,
      body: {
        id: 'profile-id',
        userId: 'user-id',
        orgName: 'Test Org',
        supportEmail: 'support@test.org',
      },
    }).as('createProfile');

    // Set auth cookie to simulate authentication
    cy.setCookie('accessToken', 'mock-access-token');
  });

  it('should display onboarding wizard Step 1 for authenticated user with no profile', () => {
    cy.visit('/organizer/onboarding');
    
    // Wait for profile check to complete
    cy.wait('@getProfile');
    
    // Should show Step 1 with organization details
    cy.contains('Set up your organizer profile').should('be.visible');
    cy.contains('Step 1 of 2').should('be.visible');
    cy.contains('Organization Details').should('be.visible');
    
    // Required fields should be present
    cy.get('input[name="orgName"]').should('be.visible');
    cy.get('input[name="supportEmail"]').should('be.visible');
    cy.get('input[name="legalName"]').should('be.visible');
    cy.get('input[name="website"]').should('be.visible');
    cy.get('input[name="supportPhone"]').should('be.visible');
  });

  it('should validate required fields on Step 1', () => {
    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Try to proceed without filling required fields
    cy.contains('button', 'Next').click();
    
    // Should show validation errors and stay on Step 1
    cy.contains('Step 1 of 2').should('be.visible');
    cy.contains('Organization name must be at least 2 characters').should('be.visible');
  });

  it('should proceed to Step 2 when Step 1 is valid', () => {
    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Fill required fields
    cy.get('input[name="orgName"]').type('Test Organization');
    cy.get('input[name="supportEmail"]').type('support@test.org');
    
    // Click Next
    cy.contains('button', 'Next').click();
    
    // Should show Step 2
    cy.contains('Step 2 of 2').should('be.visible');
    cy.contains('Payout Details').should('be.visible');
  });

  it('should go back to Step 1 from Step 2', () => {
    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Fill Step 1 and proceed
    cy.get('input[name="orgName"]').type('Test Organization');
    cy.get('input[name="supportEmail"]').type('support@test.org');
    cy.contains('button', 'Next').click();
    
    // Should be on Step 2
    cy.contains('Step 2 of 2').should('be.visible');
    
    // Click Back
    cy.contains('button', 'Back').click();
    
    // Should be back on Step 1
    cy.contains('Step 1 of 2').should('be.visible');
    // Form data should be preserved
    cy.get('input[name="orgName"]').should('have.value', 'Test Organization');
  });

  it('should submit form with bank account details', () => {
    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Fill Step 1
    cy.get('input[name="orgName"]').type('Test Organization');
    cy.get('input[name="supportEmail"]').type('support@test.org');
    cy.contains('button', 'Next').click();
    
    // Fill Step 2 with bank account
    cy.get('input[value="BANK_ACCOUNT"]').check();
    cy.get('input[name="bankName"]').type('Test Bank');
    cy.get('input[name="bankAccountName"]').type('Test Account');
    cy.get('input[name="bankAccountNumber"]').type('123456789');
    
    // Submit
    cy.contains('button', 'Save & Continue').click();
    
    // Should call POST /api/organizer/profile
    cy.wait('@createProfile').then((interception) => {
      expect(interception.request.body).to.include({
        orgName: 'Test Organization',
        supportEmail: 'support@test.org',
        payoutMethod: 'BANK_ACCOUNT',
        bankName: 'Test Bank',
        bankAccountName: 'Test Account',
        bankAccountNumber: '123456789',
      });
    });
    
    // Should redirect to dashboard
    cy.url().should('include', '/organizer/dashboard');
  });

  it('should submit form with MPESA details', () => {
    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Fill Step 1
    cy.get('input[name="orgName"]').type('Test Organization');
    cy.get('input[name="supportEmail"]').type('support@test.org');
    cy.contains('button', 'Next').click();
    
    // Fill Step 2 with MPESA
    cy.get('input[value="MPESA"]').check();
    cy.get('input[name="mpesaPaybill"]').type('123456');
    
    // Submit
    cy.contains('button', 'Save & Continue').click();
    
    // Should call POST /api/organizer/profile
    cy.wait('@createProfile').then((interception) => {
      expect(interception.request.body).to.include({
        orgName: 'Test Organization',
        supportEmail: 'support@test.org',
        payoutMethod: 'MPESA',
        mpesaPaybill: '123456',
      });
    });
  });

  it('should redirect to dashboard if profile already exists', () => {
    // Intercept with existing profile
    cy.intercept('GET', '/api/organizer/profile', {
      statusCode: 200,
      body: {
        id: 'profile-id',
        userId: 'user-id',
        orgName: 'Existing Org',
        supportEmail: 'support@existing.org',
      },
    }).as('getExistingProfile');

    cy.visit('/organizer/onboarding');
    cy.wait('@getExistingProfile');
    
    // Should redirect to dashboard
    cy.url().should('include', '/organizer/dashboard');
  });

  it('should show error message on API failure', () => {
    // Intercept with error
    cy.intercept('POST', '/api/organizer/profile', {
      statusCode: 400,
      body: { message: 'Invalid organization name' },
    }).as('createProfileError');

    cy.visit('/organizer/onboarding');
    cy.wait('@getProfile');
    
    // Fill and submit form
    cy.get('input[name="orgName"]').type('Test');
    cy.get('input[name="supportEmail"]').type('test@example.com');
    cy.contains('button', 'Next').click();
    
    cy.get('input[value="OTHER"]').check();
    cy.contains('button', 'Save & Continue').click();
    
    cy.wait('@createProfileError');
    
    // Should show error message
    cy.contains('Invalid organization name').should('be.visible');
    // Should stay on the form
    cy.contains('Step 2 of 2').should('be.visible');
  });
});
