describe('Forgot Password Page', () => {
  beforeEach(() => {
    cy.visit('/forgot-password');
  });

  it('should display the forgot password form', () => {
    cy.contains('Forgot Password').should('be.visible');
    cy.contains('Enter your email to receive a password reset link').should('be.visible');
    
    // Check form fields
    cy.get('label').contains('Email').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.contains('button', 'Send Reset Link').should('be.visible');
  });

  it('should validate email field (format + required)', () => {
    // Test empty email
    cy.contains('button', 'Send Reset Link').click();
    cy.contains('Please enter a valid email address').should('be.visible');
    
    // Test invalid email format
    cy.get('input[type="email"]').type('invalid-email');
    cy.contains('button', 'Send Reset Link').click();
    cy.contains('Please enter a valid email address').should('be.visible');
  });

  it('should submit form and call API route handler', () => {
    // Intercept forgot password API call
    cy.intercept('POST', '/api/auth/forgot-password', {
      statusCode: 200,
      body: {
        message: 'If an account exists, a password reset email has been sent.',
      },
    }).as('forgotPasswordRequest');

    cy.get('input[type="email"]').type('test@example.com');
    cy.contains('button', 'Send Reset Link').click();

    cy.wait('@forgotPasswordRequest').then((interception) => {
      expect(interception.request.body).to.include({
        email: 'test@example.com',
      });
    });

    // Should show success message
    cy.contains('If an account exists, a password reset email has been sent.').should('be.visible');
    cy.contains('button', 'Back to Sign In').should('be.visible');
  });

  it('should show success message even on error (security best practice)', () => {
    // Intercept with error status
    cy.intercept('POST', '/api/auth/forgot-password', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('forgotPasswordRequest');

    cy.get('input[type="email"]').type('test@example.com');
    cy.contains('button', 'Send Reset Link').click();

    cy.wait('@forgotPasswordRequest');
    
    // Should still show success message for security
    cy.contains('If an account exists, a password reset email has been sent.').should('be.visible');
  });

  it('should have link back to login', () => {
    cy.contains('a', 'Back to Sign In').should('have.attr', 'href', '/login');
  });
});

