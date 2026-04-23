describe('Register Page', () => {
  beforeEach(() => {
    cy.visit('/register');
  });

  it('should display the registration form', () => {
    cy.contains('Create an Account').should('be.visible');
    cy.contains('Sign up to get started').should('be.visible');
    
    // Check form fields
    cy.get('label').contains('Name').should('be.visible');
    cy.get('input[name="name"]').should('be.visible');
    cy.get('label').contains('Email').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('label').contains('Password').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.contains('button', 'Sign Up').should('be.visible');
  });

  it('should show validation errors for empty required fields', () => {
    cy.contains('button', 'Sign Up').click();
    
    // Should show validation errors (zod validation)
    cy.contains('Name must be at least 2 characters').should('be.visible');
    cy.contains('Please enter a valid email address').should('be.visible');
    cy.contains('Password must be at least 8 characters').should('be.visible');
  });

  it('should show validation error for invalid email format', () => {
    cy.get('input[name="name"]').type('John Doe');
    cy.get('input[type="email"]').type('invalid-email').blur();
    // Validation should appear on blur
    cy.contains('Please enter a valid email address').should('be.visible');
  });

  it('should show validation error for password that is too short', () => {
    cy.get('input[name="name"]').type('John Doe');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('short');
    cy.contains('button', 'Sign Up').click();
    
    cy.contains('Password must be at least 8 characters').should('be.visible');
  });

  it('should handle successful registration', () => {
    // Set cookie before registration to allow middleware to pass
    cy.setCookie('accessToken', 'mock-access-token');

    // Mock the registration endpoint
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 200,
      body: {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'John Doe',
        },
      },
    }).as('registerRequest');

    // Mock the auth check that happens on the dashboard
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 200,
      body: {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'John Doe',
        },
      },
    }).as('getMe');

    // Fill and submit the form
    cy.get('input[name="name"]').type('John Doe');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', 'Sign Up').click();

    // Wait for the registration request
    cy.wait('@registerRequest').then((interception) => {
      expect(interception.request.body).to.include({
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password123',
      });
    });

    // Should redirect to dashboard
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
  });

  it('should handle registration error', () => {
    // Intercept register API call with error
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 409,
      body: { message: 'User with this email already exists' },
    }).as('registerRequest');

    cy.get('input[name="name"]').type('John Doe');
    cy.get('input[type="email"]').type('existing@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', 'Sign Up').click();

    cy.wait('@registerRequest');
    cy.contains('User with this email already exists').should('be.visible');
  });

  it('should have link to login page', () => {
    cy.contains('a', 'Sign in').should('have.attr', 'href', '/login');
  });
});

