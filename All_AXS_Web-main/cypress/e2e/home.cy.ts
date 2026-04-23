describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the homepage hero', () => {
    cy.contains('Live culture').should('be.visible');
  });

  it('should display the header with logo and navigation', () => {
    cy.get('header').should('be.visible');
    cy.contains('All AXS').should('be.visible');
    cy.contains('a', 'Home').should('be.visible');
    cy.contains('a', 'Events').should('be.visible');
    cy.contains('a', 'Sign in').should('be.visible');
  });

  it('should display the footer with copyright and links', () => {
    cy.get('footer').should('be.visible');
    cy.contains(/© \d{4} All AXS\. All rights reserved\./).should('be.visible');
    cy.contains('a', 'Terms').should('be.visible');
    cy.contains('a', 'Privacy').should('be.visible');
  });

  it('should surface the experience sections', () => {
    cy.contains('Built for the full journey').should('be.visible');
    cy.contains('Featured events').should('be.visible');
  });

  it('should have working primary CTAs', () => {
    cy.contains('a', 'Explore events').first().should('have.attr', 'href', '/events');
    cy.contains('a', 'Sell tickets').first().should('have.attr', 'href', '/register');
  });

  it('should navigate to events page from hero', () => {
    cy.contains('a', 'Explore events').first().click();
    cy.url().should('include', '/events');
  });

  it('should apply primary color styles', () => {
    cy.get('.bg-primary').should('exist');
  });
});
