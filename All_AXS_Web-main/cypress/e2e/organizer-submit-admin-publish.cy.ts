/**
 * P0 #7 — Web flow: draft → submit for review → admin approves (Next API routes stubbed).
 * Does not hit Nest; extend with real API + /events assertion when backend is available in CI.
 */
describe("Organizer submit → admin publish (stubbed APIs)", () => {
  const eventId = "event-publish-e2e-1";

  const draftEvent = {
    id: eventId,
    title: "Summit Publish Flow",
    type: "IN_PERSON" as const,
    venue: "Convention Hall",
    startAt: "2026-06-01T10:00:00.000Z",
    endAt: "2026-06-01T18:00:00.000Z",
    description: "E2E description",
    status: "DRAFT",
    slug: "summit-publish-flow",
    bannerUrl: null,
    ticketTypes: [],
  };

  const pendingAdminRow = {
    id: eventId,
    title: draftEvent.title,
    description: draftEvent.description,
    type: draftEvent.type,
    venue: draftEvent.venue,
    startAt: draftEvent.startAt,
    endAt: draftEvent.endAt,
    status: "PENDING_REVIEW",
    bannerUrl: null,
    createdAt: "2026-01-15T12:00:00.000Z",
    organizer: {
      id: "org-e2e",
      orgName: "E2E Org",
      user: {
        id: "organizer-user-id",
        email: "organizer@example.com",
        name: "Organizer User",
      },
    },
    ticketTypes: [{ id: "tier-1", name: "GA" }],
  };

  it("submits as organizer, then admin approves from moderation queue", () => {
    let authPersona: "organizer" | "admin" = "organizer";

    cy.intercept("GET", "**/api/auth/me", (req) => {
      if (authPersona === "organizer") {
        req.reply({
          statusCode: 200,
          body: {
            user: {
              id: "organizer-user-id",
              email: "organizer@example.com",
              name: "Organizer User",
              roles: ["ORGANIZER"],
            },
          },
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            user: {
              id: "admin-user-id",
              email: "admin@example.com",
              name: "Admin User",
              roles: ["ADMIN"],
            },
          },
        });
      }
    }).as("authMe");

    cy.intercept("GET", `**/api/events/${eventId}`, {
      statusCode: 200,
      body: draftEvent,
    }).as("getEvent");

    cy.intercept("POST", `**/api/events/${eventId}/submit`, {
      statusCode: 200,
      body: { ...draftEvent, status: "PENDING_REVIEW" },
    }).as("submitEvent");

    let adminQueueApproved = false;
    cy.intercept("GET", "**/api/admin/events*", (req) => {
      // React Strict Mode can double-fetch; never empty the queue until approve succeeds.
      req.reply({
        statusCode: 200,
        body: adminQueueApproved ? [] : [pendingAdminRow],
      });
    }).as("adminEvents");

    cy.intercept("POST", `**/api/admin/events/${eventId}/approve`, (req) => {
      adminQueueApproved = true;
      req.reply({
        statusCode: 200,
        body: { id: eventId, status: "PUBLISHED" },
      });
    }).as("approveEvent");

    cy.setCookie("accessToken", "mock-access-token");

    cy.visit(`/organizer/events/${eventId}/edit`);
    cy.wait("@getEvent");

    cy.contains("button", "Submit for Review").click();
    cy.wait("@submitEvent");
    // Status badge uses humanized copy: underscores → spaces
    cy.contains(/pending review/i).should("be.visible");

    authPersona = "admin";

    cy.visit("/admin/moderation", {
      onBeforeLoad(win) {
        cy.stub(win, "confirm").returns(true);
      },
    });
    cy.wait("@adminEvents");

    cy.contains("Event Moderation Queue").should("be.visible");
    cy.contains("td", draftEvent.title).should("be.visible");

    cy.contains("button", "Review").click();
    cy.contains("h3", draftEvent.title).should("be.visible");

    cy.contains("button", "Approve").click();
    cy.wait("@approveEvent");
    cy.contains("Event approved successfully!").should("be.visible");

    cy.wait("@adminEvents");
    cy.contains("No events waiting for review").should("be.visible");
  });
});
