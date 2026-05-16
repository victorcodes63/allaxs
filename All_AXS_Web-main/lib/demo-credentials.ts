/** Seeded demo users (API `seed-demo-flow` / `docs/DEMO_ROLES_AND_CHECKOUT.md`). */
export const DEMO_PASSWORD = "DemoFlow123!" as const;

export const DEMO_ACCOUNTS = [
  {
    role: "Attendee",
    email: "demo-attendee@allaxs.demo",
    note: "Tickets & fan hub",
  },
  {
    role: "Organizer",
    email: "demo-organizer@allaxs.demo",
    note: "Events, sales & check-in",
  },
  {
    role: "Admin",
    email: "demo-admin@allaxs.demo",
    note: "Moderation & platform admin",
  },
] as const;
