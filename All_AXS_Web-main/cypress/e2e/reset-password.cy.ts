describe('Reset Password Page', () => {
  it('should display error when token is missing', () => {
    cy.visit('/reset-password');
    
    cy.contains('Reset Password').should('be.visible');
    cy.contains('Invalid or missing reset token').should('be.visible');
    
    // Form should be disabled
    cy.get('input[type="password"]').should('be.disabled');
    cy.contains('button', 'Reset Password').should('be.disabled');
  });

  it('should display the reset password form with valid token', () => {
    const fakeToken = 'test-reset-token-123';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    cy.contains('Reset Password').should('be.visible');
    cy.contains('Enter your new password').should('be.visible');
    
    // Check form fields
    cy.get('label').contains('New Password').should('be.visible');
    cy.get('input[name="newPassword"]').should('be.visible');
    cy.get('label').contains('Confirm New Password').should('be.visible');
    cy.get('input[name="confirmNewPassword"]').should('be.visible');
    cy.contains('button', 'Reset Password').should('be.visible');
  });

  it('should validate minimum length requirement', () => {
    const fakeToken = 'test-reset-token-123';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    cy.get('input[name="newPassword"]').type('short');
    cy.get('input[name="confirmNewPassword"]').type('short');
    cy.contains('button', 'Reset Password').click();
    
    cy.contains('Password must be at least 8 characters').should('be.visible');
  });

  it('should validate mismatched password error', () => {
    const fakeToken = 'test-reset-token-123';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    cy.get('input[name="newPassword"]').type('password123');
    cy.get('input[name="confirmNewPassword"]').type('different123');
    cy.contains('button', 'Reset Password').click();
    
    cy.contains('Passwords do not match').should('be.visible');
  });

  it('should submit form and call API route handler', () => {
    const fakeToken = 'test-reset-token-123';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    // Intercept reset password API call
    cy.intercept('POST', '/api/auth/reset-password', {
      statusCode: 200,
      body: {
        message: 'Password reset successfully',
      },
    }).as('resetPasswordRequest');

    cy.get('input[name="newPassword"]').type('newpassword123');
    cy.get('input[name="confirmNewPassword"]').type('newpassword123');
    cy.contains('button', 'Reset Password').click();

    cy.wait('@resetPasswordRequest').then((interception) => {
      expect(interception.request.body).to.include({
        token: fakeToken,
        newPassword: 'newpassword123',
      });
    });

    // Should show success state
    cy.contains('Password Reset Successful').should('be.visible');
    cy.contains('Password reset successfully. You can now log in with your new password.').should('be.visible');
    cy.contains('button', 'Go to Sign In').should('be.visible');
  });

  it('should handle reset password error', () => {
    const fakeToken = 'invalid-token';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    // Intercept with error
    cy.intercept('POST', '/api/auth/reset-password', {
      statusCode: 400,
      body: { message: 'Invalid or expired reset token' },
    }).as('resetPasswordRequest');

    cy.get('input[name="newPassword"]').type('newpassword123');
    cy.get('input[name="confirmNewPassword"]').type('newpassword123');
    cy.contains('button', 'Reset Password').click();

    cy.wait('@resetPasswordRequest');
    cy.contains('Invalid or expired reset token').should('be.visible');
  });

  it('should have link back to login', () => {
    const fakeToken = 'test-reset-token-123';
    cy.visit(`/reset-password?token=${fakeToken}`);
    
    cy.contains('a', 'Back to Sign In').should('have.attr', 'href', '/login');
  });
});

