describe("Coupons checkout", () => {
  beforeEach(() => {
    cy.intercept("GET", "**/api/auth/me", {
      statusCode: 401,
      body: { message: "Unauthorized" },
    }).as("getMe");

    cy.intercept("POST", "**/api/checkout/coupons/preview", {
      statusCode: 200,
      body: {
        valid: true,
        code: "SAVE20",
        subtotalCents: 24900,
        discountCents: 4980,
        amountCents: 19920,
        feesCents: 996,
        currency: "KES",
      },
    }).as("previewCoupon");
  });

  it("applies a valid percent code and shows the discount in the order summary", () => {
    cy.visit("/events/demo-evt-01/checkout");

    cy.contains("Complete your purchase").should("be.visible");
    cy.contains("General").should("be.visible");

    cy.get('button[aria-label="Increase"]').first().click();
    cy.contains("249 KES").should("be.visible");

    cy.get('input[autoComplete="name"]').type("Test Buyer");
    cy.get('input[type="email"]').type("buyer@example.com");

    cy.contains("Have a code?").should("be.visible");
    cy.get('input[placeholder="Promo code"]').type("save20");
    cy.contains("button", "Apply").click();
    cy.wait("@previewCoupon");

    cy.contains("SAVE20").should("be.visible");
    cy.contains("save 50 KES").should("be.visible");
    cy.contains("dt", "Discount").should("be.visible");
    cy.contains("−49.8 KES").should("be.visible");
    cy.contains("dt", "Due today").parent().should("contain.text", "199.2 KES");
  });

  it("surfaces preview errors for invalid codes", () => {
    cy.intercept("POST", "**/api/checkout/coupons/preview", {
      statusCode: 200,
      body: {
        valid: false,
        errorCode: "EXPIRED",
        message: "This coupon has expired.",
        code: "OLDCODE",
      },
    }).as("previewExpired");

    cy.visit("/events/demo-evt-01/checkout");
    cy.get('button[aria-label="Increase"]').first().click();
    cy.get('input[placeholder="Promo code"]').type("OLDCODE");
    cy.contains("button", "Apply").click();
    cy.wait("@previewExpired");

    cy.contains("This coupon has expired.").should("be.visible");
    cy.contains("dt", "Discount").should("not.exist");
  });
});
