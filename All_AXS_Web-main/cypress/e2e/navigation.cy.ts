describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should navigate to home from header link', () => {
    cy.visit('/events');
    cy.contains('a', 'Home').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should navigate to events page from header', () => {
    cy.contains('a', 'Events').click();
    cy.url().should('include', '/events');
    cy.contains('h1', 'Find your next live moment').should('be.visible');
  });

  it('should navigate to login page from header', () => {
    // Sign in is now a button
    cy.contains('button', 'Sign in').click();
    cy.url().should('include', '/login');
  });

  it('should not show organizer link when not authenticated', () => {
    // Wait for auth check to complete
    cy.wait(500);
    // Organizer link only appears when authenticated
    cy.get('nav').within(() => {
      cy.contains('a', 'Organizer').should('not.exist');
    });
  });

  it('should redirect to login when accessing dashboard directly', () => {
    cy.visit('/dashboard');
    // Should redirect to login because user is not authenticated
    cy.url().should('include', '/login');
    cy.url().should('include', 'next=%2Fdashboard');
  });

  it('should have consistent header across all pages', () => {
    const pages = ['/', '/events', '/login'];
    
    pages.forEach((page) => {
      cy.visit(page);
      cy.get('header').should('be.visible');
      cy.contains('All AXS').should('be.visible');
    });
  });

  it('should have consistent footer across all pages', () => {
    const pages = ['/', '/events', '/login'];
    
    pages.forEach((page) => {
      cy.visit(page);
      cy.get('footer').should('be.visible');
      cy.contains('Terms').should('be.visible');
      cy.contains('Privacy').should('be.visible');
    });
  });

  it('should highlight active nav links on hover', () => {
    cy.contains('a', 'Events')
      .trigger('mouseover')
      .should('have.class', 'hover:text-primary');
  });
});
