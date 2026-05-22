describe("Organizer coupons CRUD", () => {
  const eventId = "event-id-123";
  const API_URL = Cypress.env("API_URL") || "http://localhost:8080";

  const mockEvent = {
    id: eventId,
    title: "Test Event",
    type: "IN_PERSON",
    venue: "Test Venue",
    startAt: "2025-12-01T10:00:00Z",
    endAt: "2025-12-01T18:00:00Z",
    description: "Test description",
    status: "DRAFT",
    slug: "test-event",
    bannerUrl: null,
    ticketTypes: [],
  };

  let coupons: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    coupons = [];

    cy.intercept("GET", "**/api/auth/me", {
      statusCode: 200,
      body: {
        user: {
          id: "organizer-user-id",
          email: "organizer@example.com",
          name: "Organizer User",
          roles: ["ORGANIZER"],
        },
      },
    }).as("getMe");

    cy.intercept("GET", "**/api/auth/token", {
      statusCode: 200,
      body: { token: "mock-access-token" },
    }).as("getToken");

    cy.setCookie("accessToken", "mock-access-token");

    cy.intercept("GET", `**/api/events/${eventId}`, {
      statusCode: 200,
      body: mockEvent,
    }).as("getEvent");

    cy.intercept("GET", `${API_URL}/events/${eventId}/coupons`, (req) => {
      req.reply({ statusCode: 200, body: coupons });
    }).as("listCoupons");

    cy.intercept("POST", `${API_URL}/events/${eventId}/coupons`, (req) => {
      const created = {
        id: "coupon-new-id",
        eventId,
        usedCount: 0,
        active: true,
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        ...req.body,
        code: String(req.body.code).toUpperCase(),
      };
      coupons = [created];
      req.reply({ statusCode: 201, body: created });
    }).as("createCoupon");

    cy.intercept("PATCH", `${API_URL}/coupons/*`, (req) => {
      const id = req.url.split("/coupons/")[1]?.split("?")[0];
      coupons = coupons.map((c) =>
        c.id === id
          ? {
              ...c,
              ...req.body,
              code: req.body.code ? String(req.body.code).toUpperCase() : c.code,
              updatedAt: "2026-05-01T11:00:00.000Z",
            }
          : c,
      );
      req.reply({ statusCode: 200, body: coupons.find((c) => c.id === id) });
    }).as("updateCoupon");

    cy.intercept("DELETE", `${API_URL}/coupons/*`, (req) => {
      const id = req.url.split("/coupons/")[1]?.split("?")[0];
      coupons = coupons.filter((c) => c.id !== id);
      req.reply({ statusCode: 200, body: { deleted: true, disabled: false, couponId: id } });
    }).as("deleteCoupon");
  });

  it("creates, edits, and deletes a coupon from the event editor tab", () => {
    cy.visit(`/organizer/events/${eventId}/edit?tab=coupons`);
    cy.wait("@getEvent");
    cy.wait("@listCoupons");

    cy.contains("Coupons").should("be.visible");
    cy.contains("No coupons yet").should("be.visible");
    cy.contains("button", "Create coupon").click();

    cy.contains("Create coupon").should("be.visible");
    cy.get("#input-code").type("EARLY2026");
    cy.get("#input-percent-off").clear().type("15");
    cy.contains("button", "Create coupon").last().click();
    cy.wait("@createCoupon");

    cy.contains('Coupon "EARLY2026" created.').should("be.visible");
    cy.contains("EARLY2026").should("be.visible");
    cy.contains("15% off").should("be.visible");

    cy.contains("button", "Edit").click();
    cy.get("#input-percent-off").clear().type("25");
    cy.contains("button", "Save changes").click();
    cy.wait("@updateCoupon");

    cy.contains('Coupon "EARLY2026" updated.').should("be.visible");
    cy.contains("25% off").should("be.visible");

    cy.on("window:confirm", () => true);
    cy.contains("button", "Delete").click();
    cy.wait("@deleteCoupon");

    cy.contains('Coupon "EARLY2026" deleted.').should("be.visible");
    cy.contains("No coupons yet").should("be.visible");
  });
});
