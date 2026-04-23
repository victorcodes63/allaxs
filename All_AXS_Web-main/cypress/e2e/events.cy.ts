describe('Events Page', () => {
  beforeEach(() => {
    cy.visit('/events');
  });

  it('should display the events page heading', () => {
    cy.contains('h1', 'Events').should('be.visible');
    cy.contains('Browse upcoming events').should('be.visible');
  });

  it('should display event cards', () => {
    // Should show at least 6 event cards
    cy.get('.border').should('have.length.at.least', 6);
  });

  it('should display event titles', () => {
    cy.contains('Event Title 1').should('be.visible');
    cy.contains('Event Title 2').should('be.visible');
  });

  it('should have view details buttons on each card', () => {
    cy.contains('button', 'View Details').should('exist');
  });

  it('should have proper grid layout', () => {
    // Check for responsive grid classes
    cy.get('.grid').should('exist');
  });

  it('should show placeholder image areas', () => {
    cy.get('.h-48.bg-black\\/5').should('have.length.at.least', 1);
  });
});

