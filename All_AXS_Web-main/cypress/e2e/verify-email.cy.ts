describe("Verify Email Page", () => {
  it("should show success state when verification succeeds", () => {
    const token = "test-success-token";
    cy.intercept("POST", "/api/auth/verify-email", {
      statusCode: 200,
      body: { message: "Email verified successfully" },
    }).as("verifyEmail");

    cy.visit(`/verify-email?token=${token}`);

    cy.wait("@verifyEmail").then((interception) => {
      expect(interception.request.body).to.deep.equal({ token });
    });

    cy.contains("Email verified successfully").should("be.visible");
    cy.contains("Continue to Sign In").should("be.visible");
  });

  it("should show error state when verification fails", () => {
    const token = "test-error-token";
    cy.intercept("POST", "/api/auth/verify-email", {
      statusCode: 400,
      body: { message: "Invalid or expired verification token" },
    }).as("verifyEmailError");

    cy.visit(`/verify-email?token=${token}`);

    cy.wait("@verifyEmailError").then((interception) => {
      expect(interception.request.body).to.deep.equal({ token });
    });

    cy.contains("Invalid or expired verification token").should("be.visible");
    cy.contains("Back to Sign In").should("be.visible");
  });
});


