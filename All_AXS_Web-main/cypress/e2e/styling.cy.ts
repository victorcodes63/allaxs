describe('Styling and Theming', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should use theme background and foreground on body', () => {
    cy.get('body').should('have.class', 'bg-background');
    cy.get('body').should('have.class', 'text-foreground');
  });

  it('should display the brand logo in the header', () => {
    cy.get('header').within(() => {
      cy.get('img[src*="logo-header"]').should('be.visible');
    });
  });

  it('should apply primary color to key CTAs', () => {
    cy.get('.bg-primary').should('exist');
    cy.contains('a', 'Explore events').should('have.class', 'bg-primary');
  });

  it('should have hover states on navigation links', () => {
    cy.get('nav a').each(($link) => {
      cy.wrap($link).should('have.class', 'hover:text-primary');
    });
  });

  it('should use the page shell on main content', () => {
    cy.get('main').should('have.class', 'axs-page-shell');
  });

  it('should have vertical padding on main content', () => {
    cy.get('main').should('have.class', 'py-8');
  });

  it('should have border styling on header bar and footer', () => {
    cy.get('header').find('.border-b').should('exist');
    cy.get('footer').should('have.class', 'border-t');
  });

  it('should have rounded corners on buttons', () => {
    cy.get('button, a[class*="rounded"]').should('exist');
  });

  it('should apply transition effects', () => {
    cy.get('[class*="transition"]').should('exist');
  });

  it('should have consistent spacing', () => {
    cy.get('[class*="space-y"]').should('exist');
    cy.get('[class*="gap"]').should('exist');
  });
});
