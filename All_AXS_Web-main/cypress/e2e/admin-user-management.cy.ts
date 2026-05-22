/**
 * Admin user management E2E (stubbed APIs).
 *
 * Coverage:
 *   1. Admin reaches /admin overview with a valid session cookie.
 *   2. Admin opens the moderation queue, sees pending events, and approves one.
 *   3. Admin opens /admin/users, searches, and suspends an active attendee.
 *   4. Admin reactivates the same user.
 *   5. Role-change audit history (promote → suspend → reactivate).
 *   6. Admin login lands on /admin without marketing header flash.
 *
 * Everything backend-side is intercepted so this spec can run without a live
 * Nest instance — same pattern as `organizer-submit-admin-publish.cy.ts`.
 * Pair this spec with `organizer-submit-admin-publish.cy.ts` for a full
 * sign-in → moderation → user management regression net on the admin
 * surface area called out in docs/ADMIN_TODO.md (Section 8).
 */

interface SeededUser {
  id: string;
  email: string;
  name?: string | null;
  roles: ("ATTENDEE" | "ORGANIZER" | "ADMIN")[];
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt?: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  admin: { id: string; email: string; name?: string | null } | null;
}

const adminUser = {
  id: "admin-user-id",
  email: "demo-admin@allaxs.demo",
  name: "Demo Admin",
  roles: ["ADMIN"],
};

const pendingEvent = {
  id: "evt-pending-admin-e2e",
  title: "Indie Music Night",
  type: "IN_PERSON" as const,
  venue: "Acoustic Club",
  startAt: "2026-07-04T18:00:00.000Z",
  endAt: "2026-07-04T23:00:00.000Z",
  status: "PENDING_REVIEW" as const,
  bannerUrl: null,
  createdAt: "2026-05-01T12:00:00.000Z",
  submittedAt: "2026-05-04T15:00:00.000Z",
  organizer: {
    id: "org-music",
    orgName: "Indie Music Co.",
    user: {
      id: "user-org-music",
      email: "music@example.com",
      name: "Music Org",
    },
  },
  ticketTypes: [{ id: "tier-music-ga", name: "GA" }],
};

const attendeeId = "user-attendee-1";

describe("Admin: moderation + user management (stubbed APIs)", () => {
  beforeEach(() => {
    // Admin /api/auth/me — every page-load hits this for role detection.
    cy.intercept("GET", "**/api/auth/me", {
      statusCode: 200,
      body: { user: adminUser },
    }).as("authMe");

    cy.setCookie("accessToken", "mock-admin-access-token");
  });

  it("approves a pending event from the moderation queue", () => {
    let queueApproved = false;
    cy.intercept("GET", "**/api/admin/events*", (req) => {
      // React Strict Mode can double-fetch — keep the row in place until
      // the approve POST resolves.
      req.reply({
        statusCode: 200,
        body: queueApproved ? [] : [pendingEvent],
      });
    }).as("adminEvents");

    cy.intercept(
      "POST",
      `**/api/admin/events/${pendingEvent.id}/approve`,
      (req) => {
        queueApproved = true;
        req.reply({
          statusCode: 200,
          body: { id: pendingEvent.id, status: "PUBLISHED" },
        });
      },
    ).as("approveEvent");

    cy.visit("/admin/moderation", {
      onBeforeLoad(win) {
        cy.stub(win, "confirm").returns(true);
      },
    });
    cy.wait("@authMe");
    cy.wait("@adminEvents");

    cy.contains("Event Moderation Queue").should("be.visible");
    cy.contains("td", pendingEvent.title).should("be.visible");

    cy.contains("button", "Review").click();
    cy.contains("h3", pendingEvent.title).should("be.visible");
    cy.contains("button", "Approve").click();
    cy.wait("@approveEvent");

    cy.contains("Event approved successfully!").should("be.visible");
    cy.wait("@adminEvents");
    cy.contains("No events waiting for review").should("be.visible");
  });

  it("suspends and then reactivates an attendee", () => {
    const initialUser: SeededUser = {
      id: attendeeId,
      email: "fan@example.com",
      name: "Loyal Fan",
      roles: ["ATTENDEE"],
      status: "ACTIVE",
      createdAt: "2026-04-01T08:00:00.000Z",
      updatedAt: "2026-04-01T08:00:00.000Z",
      emailVerifiedAt: "2026-04-01T08:00:00.000Z",
    };

    // Mutable in-flight copy so the GET reflects PATCH outcomes.
    let currentUser: SeededUser = { ...initialUser };

    cy.intercept("GET", "**/api/admin/users*", (req) => {
      const url = new URL(req.url);
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const matches =
        !search ||
        currentUser.email.toLowerCase().includes(search) ||
        (currentUser.name || "").toLowerCase().includes(search);
      req.reply({
        statusCode: 200,
        body: {
          users: matches ? [currentUser] : [],
          total: matches ? 1 : 0,
          limit: 25,
          offset: 0,
        },
      });
    }).as("adminUsers");

    cy.intercept(
      "PATCH",
      `**/api/admin/users/${attendeeId}/status`,
      (req) => {
        const body = req.body as { status?: SeededUser["status"] };
        if (body?.status) {
          currentUser = {
            ...currentUser,
            status: body.status,
            updatedAt: new Date().toISOString(),
          };
        }
        req.reply({ statusCode: 200, body: currentUser });
      },
    ).as("patchStatus");

    cy.visit("/admin/users", {
      onBeforeLoad(win) {
        // The suspend/reactivate confirm dialogs use window.confirm.
        cy.stub(win, "confirm").returns(true);
      },
    });
    cy.wait("@authMe");
    cy.wait("@adminUsers");

    cy.contains("Loyal Fan").should("be.visible");

    // Suspend — clicking the row action opens a UserActionConfirmDialog
    // (role="dialog"). We scope the confirm click to the dialog so the
    // row-level "Suspend" button doesn't collide with the dialog CTA copy.
    cy.get('[aria-label="Suspend Loyal Fan"]').click();
    cy.get('[role="dialog"]').contains("button", "Suspend").click();
    cy.wait("@patchStatus")
      .its("request.body")
      .should("deep.include", { status: "SUSPENDED" });
    cy.wait("@adminUsers");
    cy.contains(/suspended/i).should("be.visible");

    // Reactivate — same dialog pattern, opposite verb.
    cy.get('[aria-label="Reactivate Loyal Fan"]').click();
    cy.get('[role="dialog"]').contains("button", "Reactivate").click();
    cy.wait("@patchStatus")
      .its("request.body")
      .should("deep.include", { status: "ACTIVE" });
    cy.wait("@adminUsers");
  });

  it("opens the user detail page and force-logs-out the user", () => {
    const userDetail = {
      id: attendeeId,
      email: "fan@example.com",
      name: "Loyal Fan",
      roles: ["ATTENDEE"],
      status: "ACTIVE",
      createdAt: "2026-04-01T08:00:00.000Z",
      updatedAt: "2026-04-01T08:00:00.000Z",
      emailVerifiedAt: "2026-04-01T08:00:00.000Z",
      lastLoginAt: "2026-05-10T19:42:00.000Z",
      orders: [],
      tickets: [],
      events: [],
      auditTrail: [],
    };

    cy.intercept("GET", `**/api/admin/users/${attendeeId}`, {
      statusCode: 200,
      body: userDetail,
    }).as("getUser");

    cy.intercept(
      "POST",
      `**/api/admin/users/${attendeeId}/force-logout`,
      {
        statusCode: 200,
        body: { revokedSessions: 2 },
      },
    ).as("forceLogout");

    cy.visit(`/admin/users/${attendeeId}`, {
      onBeforeLoad(win) {
        cy.stub(win, "confirm").returns(true);
      },
    });
    cy.wait("@authMe");
    cy.wait("@getUser");

    cy.contains(userDetail.email).should("be.visible");

    // The detail page exposes a "Force sign-out" row action which opens a
    // confirm dialog whose CTA reads "Sign out everywhere".
    cy.contains("button", "Force sign-out").click();
    cy.get('[role="dialog"]')
      .contains("button", "Sign out everywhere")
      .click();
    cy.wait("@forceLogout");
  });

  it("records role-change audit history through promote, suspend, and reactivate", () => {
    const initialUser: SeededUser = {
      id: attendeeId,
      email: "fan@example.com",
      name: "Loyal Fan",
      roles: ["ATTENDEE"],
      status: "ACTIVE",
      createdAt: "2026-04-01T08:00:00.000Z",
      updatedAt: "2026-04-01T08:00:00.000Z",
      emailVerifiedAt: "2026-04-01T08:00:00.000Z",
    };

    let currentUser: SeededUser = { ...initialUser };
    const auditTrail: AuditEntry[] = [];

    cy.intercept("GET", "**/api/admin/users*", (req) => {
      req.reply({
        statusCode: 200,
        body: {
          users: [currentUser],
          total: 1,
          limit: 25,
          offset: 0,
        },
      });
    }).as("adminUsers");

    cy.intercept("GET", `**/api/admin/users/${attendeeId}/audit`, (req) => {
      req.reply({
        statusCode: 200,
        body: auditTrail,
      });
    }).as("userAudit");

    cy.intercept(
      "PATCH",
      `**/api/admin/users/${attendeeId}/roles`,
      (req) => {
        const body = req.body as { roles?: SeededUser["roles"] };
        const oldRoles = [...currentUser.roles];
        if (body?.roles) {
          currentUser = {
            ...currentUser,
            roles: body.roles,
            updatedAt: new Date().toISOString(),
          };
        }
        auditTrail.unshift({
          id: `audit-roles-${auditTrail.length}`,
          action: "UPDATE_USER_ROLES",
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
          metadata: {
            oldRoles,
            newRoles: currentUser.roles,
          },
          admin: adminUser,
        });
        req.reply({ statusCode: 200, body: currentUser });
      },
    ).as("patchRoles");

    cy.intercept(
      "PATCH",
      `**/api/admin/users/${attendeeId}/status`,
      (req) => {
        const body = req.body as { status?: SeededUser["status"] };
        const previousStatus = currentUser.status;
        if (body?.status) {
          currentUser = {
            ...currentUser,
            status: body.status,
            updatedAt: new Date().toISOString(),
          };
        }
        auditTrail.unshift({
          id: `audit-status-${auditTrail.length}`,
          action: "UPDATE_USER_STATUS",
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
          metadata: {
            previousStatus,
            newStatus: currentUser.status,
          },
          admin: adminUser,
        });
        req.reply({ statusCode: 200, body: currentUser });
      },
    ).as("patchStatus");

    cy.visit("/admin/users");
    cy.wait("@authMe");
    cy.wait("@adminUsers");

    cy.get('[aria-label="Promote Loyal Fan to admin"]').click();
    cy.get('[role="dialog"]').contains("button", "Promote").click();
    cy.wait("@patchRoles");
    cy.wait("@adminUsers");

    cy.get('[aria-label="Suspend Loyal Fan"]').click();
    cy.get('[role="dialog"]').contains("button", "Suspend").click();
    cy.wait("@patchStatus")
      .its("request.body")
      .should("deep.include", { status: "SUSPENDED" });
    cy.wait("@adminUsers");

    cy.get('[aria-label="Reactivate Loyal Fan"]').click();
    cy.get('[role="dialog"]').contains("button", "Reactivate").click();
    cy.wait("@patchStatus")
      .its("request.body")
      .should("deep.include", { status: "ACTIVE" });
    cy.wait("@adminUsers");

    cy.get('[aria-label="Audit history for Loyal Fan"]').click();
    cy.wait("@userAudit");

    cy.get('[role="dialog"]').within(() => {
      cy.contains("Updated roles").should("be.visible");
      cy.contains("ATTENDEE").should("be.visible");
      cy.contains("ADMIN").should("be.visible");
      cy.contains("Updated status").should("have.length", 2);
      cy.contains("ACTIVE").should("be.visible");
      cy.contains("SUSPENDED").should("be.visible");
    });
  });

  it("lands on /admin after login without marketing header flash", () => {
    cy.intercept("POST", "**/api/auth/login", {
      statusCode: 200,
      body: { message: "Login successful" },
    }).as("login");

    cy.intercept("GET", "**/api/auth/me", (req) => {
      req.reply({
        delay: 1500,
        statusCode: 200,
        body: { user: adminUser },
      });
    }).as("slowAuthMe");

    cy.intercept("GET", "**/api/admin/overview", {
      statusCode: 200,
      body: {
        generatedAt: new Date().toISOString(),
        events: {
          byStatus: {},
          submissionTrend: [],
          pendingReviewQueue: [],
        },
        orders: {
          byStatus: {},
          paid: { count: 0, grossCents: 0, feesCents: 0, netCents: 0 },
          refunded: { count: 0, grossCents: 0 },
          paidTrend: [],
          refundedTrend: [],
        },
        users: {
          total: 0,
          admins: 1,
          organizers: 0,
          attendees: 0,
        },
        recentActivity: [],
      },
    }).as("adminOverview");

    cy.visit("/login");
    cy.get('input[type="email"]').type(adminUser.email);
    cy.get('input[type="password"]').type("demo-password");
    cy.contains("button", "Sign In").click();

    cy.wait("@login");
    cy.url().should("include", "/admin");

    // Marketing chrome must never appear while auth resolves slowly.
    cy.contains("a", "For organizers").should("not.exist");
    cy.contains("a", "Sign up").should("not.exist");

    cy.contains("Admin overview", { timeout: 10000 }).should("be.visible");
    cy.wait("@slowAuthMe");
    cy.wait("@adminOverview");
    cy.contains("a", "For organizers").should("not.exist");
  });
});
