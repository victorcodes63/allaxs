describe('Accessibility', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have proper lang attribute on html', () => {
    cy.get('html').should('have.attr', 'lang', 'en');
  });

  it('should have semantic HTML structure', () => {
    cy.get('header').should('exist');
    cy.get('main').should('exist');
    cy.get('footer').should('exist');
    cy.get('nav').should('exist');
  });

  it('should have proper heading hierarchy', () => {
    cy.get('h1').should('exist');
  });

  it('should have accessible form labels on login page', () => {
    cy.visit('/login');
    // Labels exist with for attributes
    cy.get('label').contains('Email').should('exist');
    cy.get('label').contains('Password').should('exist');
    // Inputs have matching IDs
    cy.get('input[type="email"]').should('have.attr', 'id').and('match', /email/);
    cy.get('input[type="password"]').should('have.attr', 'id').and('match', /password/);
  });

  it('should have descriptive link text', () => {
    cy.get('a').each(($link) => {
      cy.wrap($link).invoke('text').invoke('trim').should('not.be.empty');
    });
  });

  it('should have keyboard focusable elements', () => {
    // Check that links and buttons are focusable
    cy.get('a').first().focus();
    cy.focused().should('exist');
  });

  it('should have visible focus states on interactive elements', () => {
    cy.get('a').first().focus();
    cy.focused().should('be.visible');
  });

  it('should have proper button types on forms', () => {
    cy.visit('/login');
    cy.get('button[type="submit"]').should('exist');
  });

  it('should have autocomplete attributes on form inputs', () => {
    cy.visit('/login');
    cy.get('input[autocomplete="email"]').should('exist');
    cy.get('input[autocomplete="current-password"]').should('exist');
  });
});
