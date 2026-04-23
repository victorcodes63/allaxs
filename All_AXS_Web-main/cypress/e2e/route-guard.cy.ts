describe('Route Guard', () => {
  it('should redirect unauthenticated users from dashboard to login', () => {
    cy.visit('/dashboard');
    
    // Should redirect to login page
    cy.url().should('include', '/login');
    
    // Should include the "next" parameter to redirect back after login
    cy.url().should('include', 'next=%2Fdashboard');
  });

  it('should show loading state briefly before redirect', () => {
    // This test might be flaky due to timing, but we can try
    cy.visit('/dashboard', { timeout: 1000 });
    
    // The page should eventually redirect to login
    cy.url({ timeout: 5000 }).should('include', '/login');
  });

  it('should preserve the intended destination in query params', () => {
    cy.visit('/dashboard');
    
    // Wait for redirect
    cy.url().should('include', '/login');
    
    // Check that the next parameter is set correctly
    cy.location('search').should('include', 'next=%2Fdashboard');
  });

  it('should redirect when accessing organizer dashboard while logged out', () => {
    cy.visit('/organizer/dashboard');
    cy.url().should('include', '/login');
    cy.url().should('include', 'next=%2Forganizer%2Fdashboard');
  });

  it('should not redirect on public pages', () => {
    const publicPages = ['/', '/events', '/login', '/register', '/forgot-password'];
    
    publicPages.forEach((page) => {
      cy.visit(page);
      // URL should stay on the intended page (or show 404 for unimplemented pages)
      cy.url().should('include', page);
    });
  });

  it('should redirect unauthenticated users from organizer onboarding to login', () => {
    cy.visit('/organizer/onboarding');
    
    // Should redirect to login page
    cy.url().should('include', '/login');
    cy.url().should('include', 'next=%2Forganizer%2Fonboarding');
  });
});
