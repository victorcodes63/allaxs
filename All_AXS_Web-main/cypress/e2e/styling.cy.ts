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
      cy.get('img[src*="logo-on-dark"]').should('be.visible');
    });
  });

  it('should apply primary color to key CTAs', () => {
    cy.get('.bg-primary').should('exist');
    cy.contains('a', 'See all').should('be.visible');
  });

  it('should have hover states on navigation links', () => {
    cy.get('header nav[aria-label="Primary"] a').each(($link) => {
      cy.wrap($link).invoke('attr', 'class').should('match', /hover:/);
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
    cy.get('footer').find('.border-t').should('exist');
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
