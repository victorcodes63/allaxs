describe("Event Editor", () => {
  beforeEach(() => {
    // Mock authenticated user
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

    // Set auth cookie
    cy.setCookie("accessToken", "mock-access-token");

    // Mock event data
    const mockEvent = {
      id: "event-id-123",
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

    cy.intercept("GET", "**/api/events/event-id-123", {
      statusCode: 200,
      body: mockEvent,
    }).as("getEvent");

    cy.intercept("PATCH", "**/api/events/event-id-123", {
      statusCode: 200,
      body: { ...mockEvent, title: "Updated Event" },
    }).as("updateEvent");

    cy.intercept("POST", "**/api/events/event-id-123/submit", {
      statusCode: 200,
      body: { ...mockEvent, status: "PENDING_REVIEW" },
    }).as("submitEvent");
  });

  it("should display event editor with three tabs", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    cy.contains("Editing").should("be.visible");
    cy.contains("Test Event").should("be.visible");

    // Check tabs are present
    cy.contains("button", "Details").should("be.visible");
    cy.contains("button", "Media").should("be.visible");
    cy.contains("button", "Ticket Tiers").should("be.visible");
  });

  it("should display event details in Details tab", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    // Details tab should be active by default
    cy.get('input[name="title"]').should("have.value", "Test Event");
    cy.get('select[name="type"]').should("have.value", "IN_PERSON");
    cy.get('input[name="venue"]').should("have.value", "Test Venue");

    // Status and slug should be displayed as read-only
    cy.contains("DRAFT").should("be.visible");
    cy.contains("test-event").should("be.visible");
  });

  it("should validate form fields in Details tab", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    // Clear title
    cy.get('input[name="title"]').clear();
    cy.get('button[type="submit"]').contains("Save").click();

    // Should show validation error
    cy.contains("Title is required").should("be.visible");
  });

  it("should save event details", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    cy.get('input[name="title"]').clear().type("Updated Event Title");
    cy.get('button[type="submit"]').contains("Save").click();

    cy.wait("@updateEvent");
    cy.contains("Event updated successfully").should("be.visible");
  });

  it("should show Submit for Review button only when status is DRAFT", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    // Button should be visible for DRAFT status
    cy.contains("button", "Submit for Review").should("be.visible");

    // Submit for review
    cy.contains("button", "Submit for Review").click();
    cy.wait("@submitEvent");

    // After submit, status should change and button should disappear
    cy.contains(/pending review/i).should("be.visible");
    cy.contains("button", "Submit for Review").should("not.exist");
  });

  it("should disable editing when event is not in editable status", () => {
    // Mock published event
    cy.intercept("GET", "**/api/events/event-id-123", {
      statusCode: 200,
      body: {
        id: "event-id-123",
        title: "Published Event",
        type: "IN_PERSON",
        venue: "Test Venue",
        startAt: "2025-12-01T10:00:00Z",
        endAt: "2025-12-01T18:00:00Z",
        status: "PUBLISHED",
        slug: "published-event",
      },
    }).as("getPublishedEvent");

    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getPublishedEvent");

    // Inputs should be disabled
    cy.get('input[name="title"]').should("be.disabled");
    cy.contains("This event cannot be edited").should("be.visible");
  });

  it("should display Media tab with upload functionality", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    // Switch to Media tab
    cy.contains("button", "Media").click();

    // Should show upload area
    cy.contains("Poster / banner").should("be.visible");
    cy.contains("No poster yet").should("be.visible");
    cy.contains("button", "Upload poster").should("be.visible");
  });

  it("should display Ticket Tiers tab", () => {
    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEvent");

    // Switch to Ticket Tiers tab
    cy.contains("button", "Ticket Tiers").click();

    // Should show empty state
    cy.contains("No ticket tiers yet").should("be.visible");
    cy.contains("button", "Add Ticket Tier").should("be.visible");
  });

  it("should handle 404 error gracefully", () => {
    cy.intercept("GET", "**/api/events/non-existent-id", {
      statusCode: 404,
      body: { message: "Event not found" },
    }).as("getNonExistentEvent");

    cy.visit("/organizer/events/non-existent-id/edit");
    cy.wait("@getNonExistentEvent");

    cy.contains("Event not found").should("be.visible");
    cy.contains("Back to events").should("be.visible");
  });

  it("should handle 403 error gracefully", () => {
    cy.intercept("GET", "**/api/events/event-id-123", {
      statusCode: 403,
      body: { message: "You do not have permission to access this event" },
    }).as("getEventForbidden");

    cy.visit("/organizer/events/event-id-123/edit");
    cy.wait("@getEventForbidden");

    cy.contains("You do not have permission").should("be.visible");
  });
});

describe("Events List and Creation", () => {
  beforeEach(() => {
    // Mock authenticated user
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

    // Set auth cookie
    cy.setCookie("accessToken", "mock-access-token");

    // Mock events list
    const mockEvents = [
      {
        id: "event-1",
        title: "Event 1",
        status: "DRAFT",
        startAt: "2025-12-01T10:00:00Z",
        endAt: "2025-12-01T18:00:00Z",
        venue: "Venue 1",
        slug: "event-1",
        type: "IN_PERSON",
      },
      {
        id: "event-2",
        title: "Event 2",
        status: "PUBLISHED",
        startAt: "2025-12-15T10:00:00Z",
        endAt: "2025-12-15T18:00:00Z",
        venue: "Venue 2",
        slug: "event-2",
        type: "VIRTUAL",
      },
    ];

    cy.intercept("GET", /\/api\/events$/, {
      statusCode: 200,
      body: mockEvents,
    }).as("getEvents");

    // Mock event creation
    const newEvent = {
      id: "event-new",
      title: "New Event",
      status: "DRAFT",
      startAt: "2025-12-20T10:00:00Z",
      endAt: "2025-12-20T18:00:00Z",
      slug: "new-event",
      type: "IN_PERSON",
    };

    cy.intercept("POST", "**/api/events", {
      statusCode: 201,
      body: newEvent,
    }).as("createEvent");
  });

  it("should display events list", () => {
    cy.visit("/organizer/events");
    cy.wait("@getEvents");

    cy.get("h1").should("contain.text", "Events");
    cy.contains("button", "Create event").should("be.visible");
    cy.contains("Event 1").should("be.visible");
    cy.contains("Event 2").should("be.visible");
  });

  it("should filter events by status", () => {
    cy.visit("/organizer/events");
    cy.wait("@getEvents");

    // Filter by DRAFT
    cy.get('select').select("DRAFT");
    cy.contains("Event 1").should("be.visible");
    cy.contains("Event 2").should("not.exist");

    // Filter by PUBLISHED
    cy.get('select').select("PUBLISHED");
    cy.contains("Event 1").should("not.exist");
    cy.contains("Event 2").should("be.visible");
  });

  it("should navigate to create event page", () => {
    cy.visit("/organizer/events");
    cy.wait("@getEvents");

    cy.contains("button", "Create event").click();
    cy.url().should("include", "/organizer/events/new");
    cy.get("h1").should("contain.text", "Create event");
  });

  it("should create event and redirect to editor", () => {
    cy.visit("/organizer/events/new");

    // Fill form
    cy.get('input[name="title"]').type("New Event");
    cy.get('select[name="type"]').select("IN_PERSON");
    cy.get('input[name="venue"]').type("Test Venue");
    cy.get('input[name="startsAt"]').type("2025-12-20T10:00");
    cy.get('input[name="endsAt"]').type("2025-12-20T18:00");

    // Submit (form primary label uses title case on the new-event page)
    cy.contains("button", "Create Event").click();
    cy.wait("@createEvent");

    // Should redirect to editor
    cy.url().should("include", "/organizer/events/event-new/edit");
  });

  it("should navigate to editor from list", () => {
    cy.intercept("GET", /\/api\/events\/event-1$/, {
      statusCode: 200,
      body: {
        id: "event-1",
        title: "Event 1",
        type: "IN_PERSON",
        venue: "Venue 1",
        startAt: "2025-12-01T10:00:00Z",
        endAt: "2025-12-01T18:00:00Z",
        description: "",
        status: "DRAFT",
        slug: "event-1",
        bannerUrl: null,
        ticketTypes: [],
      },
    }).as("getEventOne");

    cy.visit("/organizer/events");
    cy.wait("@getEvents");

    cy.get('a[href="/organizer/events/event-1/edit"]').click();
    cy.wait("@getEventOne");

    cy.url().should("include", "/organizer/events/event-1/edit");
  });

  it("should show empty state when no events", () => {
    cy.intercept("GET", /\/api\/events$/, {
      statusCode: 200,
      body: [],
    }).as("getEmptyEvents");

    cy.visit("/organizer/events");
    cy.wait("@getEmptyEvents");

    cy.contains("No events yet").should("be.visible");
    cy.contains("Create Your First Event").should("be.visible");
  });

  it("should accept paginated / wrapped organizer list payloads", () => {
    cy.intercept("GET", /\/api\/events$/, {
      statusCode: 200,
      body: {
        events: [
          {
            id: "event-wrapped-1",
            title: "Wrapped Shape Event",
            status: "DRAFT",
            startAt: "2025-12-01T10:00:00Z",
            endAt: "2025-12-01T18:00:00Z",
            venue: "Venue",
            slug: "wrapped",
            type: "IN_PERSON",
          },
        ],
        total: 1,
      },
    }).as("getEventsWrapped");

    cy.visit("/organizer/events");
    cy.wait("@getEventsWrapped");

    cy.contains("Wrapped Shape Event").should("be.visible");
  });
});

