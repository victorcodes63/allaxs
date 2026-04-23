describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the homepage hero', () => {
    cy.contains('Corporate events').should('be.visible');
    cy.get('#home-hero-heading').should('be.visible');
  });

  it('should display the header with logo and navigation', () => {
    cy.get('header').should('be.visible');
    cy.contains('All AXS').should('be.visible');
    cy.get('header').within(() => {
      cy.get('img[src*="logo-on-dark"]').should('be.visible');
    });
    cy.contains('a', 'Home').should('be.visible');
    cy.contains('a', 'Events').should('be.visible');
    cy.contains('a', 'Sign in').should('be.visible');
    cy.contains('a', 'Sign up').should('be.visible');
  });

  it('should display the footer with copyright and links', () => {
    cy.get('footer').should('be.visible');
    cy.contains(/© \d{4} All AXS\. All rights reserved\./).should('be.visible');
    cy.contains('a', 'Terms').should('be.visible');
    cy.contains('a', 'Privacy').should('be.visible');
  });

  it('should surface the experience sections', () => {
    cy.contains('Upcoming events').should('be.visible');
  });

  it('should link to events from the upcoming section', () => {
    cy.contains('a', 'See all').should('have.attr', 'href', '/events');
  });

  it('should navigate to events page from See all', () => {
    cy.contains('a', 'See all').click();
    cy.url().should('include', '/events');
  });

  it('should apply primary color styles', () => {
    cy.get('.bg-primary').should('exist');
  });
});
