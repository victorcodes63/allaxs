/**
 * Auth paths that trigger transactional emails (forgot password, verify, resend).
 * All API calls are stubbed via cy.intercept — no live Resend or backend required.
 */
describe('Auth email flows (stubbed API)', () => {
  const testEmail = 'buyer@example.com';
  const unverifiedUser = {
    id: 'user-cypress-unverified',
    email: testEmail,
    name: 'Cypress Buyer',
    emailVerified: false,
    roles: ['ATTENDEE'],
  };

  beforeEach(() => {
    cy.clearAuth();
  });

  describe('Forgot password → reset password', () => {
    it('submits forgot password then loads reset page with token param', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        statusCode: 200,
        body: {
          message: 'If an account exists, a password reset email has been sent.',
        },
      }).as('forgotPassword');

      cy.visit('/forgot-password');
      cy.get('input[type="email"]').type(testEmail);
      cy.contains('button', 'Send Reset Link').click();

      cy.wait('@forgotPassword').then((interception) => {
        expect(interception.request.body).to.deep.equal({ email: testEmail });
      });

      cy.contains('If an account exists, a password reset email has been sent.').should(
        'be.visible',
      );

      const resetToken = 'cypress-reset-token-abc';
      cy.intercept('GET', '/api/auth/reset-password/validate*', {
        statusCode: 200,
        body: { valid: true },
      }).as('validateResetToken');

      cy.visit(`/reset-password?token=${resetToken}`);
      cy.wait('@validateResetToken');

      cy.contains('Reset Password').should('be.visible');
      cy.contains('Enter your new password').should('be.visible');
      cy.get('input[name="newPassword"]').should('be.enabled');
      cy.get('input[name="confirmNewPassword"]').should('be.enabled');

      cy.intercept('POST', '/api/auth/reset-password', {
        statusCode: 200,
        body: { message: 'Password reset successfully' },
      }).as('resetPassword');

      cy.get('input[name="newPassword"]').type('newpassword123');
      cy.get('input[name="confirmNewPassword"]').type('newpassword123');
      cy.contains('button', 'Reset Password').click();

      cy.wait('@resetPassword').then((interception) => {
        expect(interception.request.body).to.include({
          token: resetToken,
          newPassword: 'newpassword123',
        });
      });

      cy.contains('Password Reset Successful').should('be.visible');
    });
  });

  describe('Register → check email', () => {
    it('submits registration then shows check-email with resend CTA', () => {
      cy.intercept('POST', '/api/auth/refresh', {
        statusCode: 401,
        body: { message: 'Unauthorized' },
      });
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 401,
        body: { message: 'Unauthorized' },
      });

      cy.intercept('POST', '/api/auth/register', {
        statusCode: 201,
        body: { user: unverifiedUser },
      }).as('register');

      cy.visit('/register');
      cy.get('input[name="name"]', { timeout: 10000 }).should('be.visible');
      cy.get('input[name="name"]').type(unverifiedUser.name);
      cy.get('input[type="email"]').type(testEmail);
      cy.get('input[type="password"]').type('password123');
      cy.contains('button', 'Sign Up').click();

      cy.wait('@register').then((interception) => {
        expect(interception.request.body).to.include({
          name: unverifiedUser.name,
          email: testEmail,
          password: 'password123',
        });
      });

      // Post-register destination: check-email with resend (visit directly after auth stub;
      // AuthSessionEntryGate may race router.replace on /register when session resolves).
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 200,
        body: { user: unverifiedUser },
      }).as('getMeAfterRegister');

      cy.visit('/check-email');
      cy.wait('@getMeAfterRegister');

      cy.contains('Check your inbox').should('be.visible');
      cy.contains(testEmail).should('be.visible');
      cy.contains('button', 'Resend verification email').should('be.visible');
    });

    it('resend on check-email posts to resend-verification with generic success', () => {
      cy.intercept('GET', '/api/auth/me', {
        statusCode: 200,
        body: { user: unverifiedUser },
      }).as('getMe');

      cy.intercept('POST', '/api/auth/resend-verification', {
        statusCode: 200,
        body: { message: 'Verification email sent' },
      }).as('resendVerification');

      cy.visit('/check-email');
      cy.wait('@getMe');

      cy.contains('button', 'Resend verification email').click();

      cy.wait('@resendVerification').then((interception) => {
        expect(interception.request.body).to.deep.equal({ email: testEmail });
      });

      cy.contains(
        'If your account is not verified yet, a new verification email has been sent.',
      ).should('be.visible');
    });
  });

  describe('Verify email → resend', () => {
    it('shows resend link when verification token fails', () => {
      const badToken = 'expired-verify-token';
      cy.intercept('POST', '/api/auth/verify-email', {
        statusCode: 400,
        body: { message: 'Invalid or expired verification token' },
      }).as('verifyEmail');

      cy.visit(`/verify-email?token=${badToken}`);

      cy.wait('@verifyEmail').then((interception) => {
        expect(interception.request.body).to.deep.equal({ token: badToken });
      });

      cy.contains('Invalid or expired verification token').should('be.visible');
      cy.contains('a', 'Resend Verification Email').should(
        'have.attr',
        'href',
        '/resend-verification',
      );
    });

    it('shows resend CTA when token param is missing', () => {
      cy.visit('/verify-email');

      cy.contains('Invalid or missing verification token').should('be.visible');
      cy.contains('a', 'Resend Verification Email').should(
        'have.attr',
        'href',
        '/resend-verification',
      );
    });
  });

  describe('Login and resend-verification entry points', () => {
    it('login page links to forgot password and resend verification', () => {
      cy.visit('/login');

      cy.contains('a', 'Forgot password').should('have.attr', 'href', '/forgot-password');
      cy.contains('a', 'Resend email').should('have.attr', 'href', '/resend-verification');
    });

    it('resend-verification page submits email and shows generic success', () => {
      cy.intercept('POST', '/api/auth/resend-verification', {
        statusCode: 200,
        body: { message: 'Verification email sent' },
      }).as('resendVerification');

      cy.visit('/resend-verification');
      cy.contains('Resend Verification Email').should('be.visible');
      cy.get('input[type="email"]').type(testEmail);
      cy.contains('button', 'Resend Verification Email').click();

      cy.wait('@resendVerification').then((interception) => {
        expect(interception.request.body).to.deep.equal({ email: testEmail });
      });

      cy.contains(
        'If an account with that email exists and is not verified, a verification email has been sent.',
      ).should('be.visible');
    });

    it('resend-verification shows success even when API errors (no enumeration)', () => {
      cy.intercept('POST', '/api/auth/resend-verification', {
        statusCode: 500,
        body: { message: 'Internal server error' },
      }).as('resendVerification');

      cy.visit('/resend-verification');
      cy.get('input[type="email"]').type(testEmail);
      cy.contains('button', 'Resend Verification Email').click();

      cy.wait('@resendVerification');

      cy.contains(
        'If an account with that email exists and is not verified, a verification email has been sent.',
      ).should('be.visible');
    });
  });
});
