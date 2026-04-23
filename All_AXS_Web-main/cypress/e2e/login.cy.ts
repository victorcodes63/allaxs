describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display the login form', () => {
    cy.contains('Sign In').should('be.visible');
    cy.contains('Enter your credentials to access your account').should('be.visible');
    
    // Check form fields
    cy.get('label').contains('Email').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('label').contains('Password').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.contains('button', 'Sign In').should('be.visible');
  });

  it('should have proper form inputs with autocomplete', () => {
    cy.get('input[type="email"]').should('have.attr', 'autocomplete', 'email');
    cy.get('input[type="password"]').should('have.attr', 'autocomplete', 'current-password');
  });

  it('should show validation errors for empty form submission', () => {
    cy.contains('button', 'Sign In').click();
    
    // Should show validation errors (zod validation)
    cy.contains('Please enter a valid email address').should('be.visible');
    cy.contains('Password is required').should('be.visible');
  });

  it('should show validation error for invalid email format', () => {
    cy.get('input[type="email"]').type('invalid-email').blur();
    // Validation should appear on blur
    cy.contains('Please enter a valid email address').should('be.visible');
  });

  it('should handle failed login with error message', () => {
    // Intercept login API call
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid credentials' },
    }).as('loginRequest');

    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.contains('button', 'Sign In').click();

    cy.wait('@loginRequest');
    cy.contains('Invalid credentials').should('be.visible');
  });

  it('should have links to register and forgot password', () => {
    cy.contains('a', 'Forgot password?').should('have.attr', 'href', '/forgot-password');
    cy.contains('a', 'Sign up').should('have.attr', 'href', '/register');
  });
});

