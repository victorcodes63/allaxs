/**
 * Public demo catalogue — keep in sync with All_AXS_Web-main `lib/data/demo-public-events.ts`
 * (titles, slugs, `/posters/*` paths, tiers). Used by `npm run seed:demo`.
 */
import { EventType, TicketTypeStatus } from '../src/domain/enums';

export type DemoCatalogueTicketSeed = {
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  minPerOrder?: number;
  maxPerOrder?: number | null;
  status: TicketTypeStatus;
};

export type DemoCatalogueEventSeed = {
  title: string;
  slug: string;
  description: string;
  type: EventType;
  venue: string;
  city: string;
  country: string;
  startAt: string;
  endAt: string;
  bannerUrl: string;
  ticketTypes: DemoCatalogueTicketSeed[];
};

const POSTER = {
  blueprint: '/posters/blueprint%20poster.webp',
  currency: '/posters/currency-exchange-poster.webp',
  giveToGain: '/posters/give-to-gain-poster.webp',
  womenAi: '/posters/state_of_women_ai_1-poster.webp',
  visioning: '/posters/visioning_poster.webp',
  wealth: '/posters/wealth-bp-poster.webp',
} as const;

export const DEMO_CATALOGUE_EVENTS: DemoCatalogueEventSeed[] = [
  {
    title: 'Blueprint: Map Your Next Move',
    slug: 'blueprint-map-your-next-move-2026',
    description:
      'A structured working session to turn goals into a clear plan—roles, milestones, and the next three actions.',
    type: EventType.VIRTUAL,
    venue: 'Online — live stream',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-04-24T15:00:00.000Z',
    endAt: '2026-04-24T16:30:00.000Z',
    bannerUrl: POSTER.blueprint,
    ticketTypes: [
      {
        name: 'General',
        description: 'Live access + replay 7 days',
        priceCents: 24900,
        currency: 'KES',
        quantityTotal: 500,
        quantitySold: 0,
        minPerOrder: 1,
        maxPerOrder: 2,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Currency & Exchange Forum',
    slug: 'currency-exchange-forum-2026',
    description:
      'Plain-language session on rates, remittances, and everyday money moves—built for students and early-career builders.',
    type: EventType.VIRTUAL,
    venue: 'Zoom webinar',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-05-02T12:00:00.000Z',
    endAt: '2026-05-02T13:15:00.000Z',
    bannerUrl: POSTER.currency,
    ticketTypes: [
      {
        name: 'RSVP',
        priceCents: 14900,
        currency: 'KES',
        quantityTotal: 800,
        quantitySold: 12,
        minPerOrder: 1,
        maxPerOrder: 1,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Give to Gain: Community Roundtable',
    slug: 'give-to-gain-community-2026',
    description:
      'Stories and frameworks for reciprocal support—how giving time and skills unlocks opportunity in your network.',
    type: EventType.VIRTUAL,
    venue: 'YouTube Live',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-05-16T14:00:00.000Z',
    endAt: '2026-05-16T15:30:00.000Z',
    bannerUrl: POSTER.giveToGain,
    ticketTypes: [
      {
        name: 'Live seat',
        priceCents: 50000,
        currency: 'KES',
        quantityTotal: 1200,
        quantitySold: 140,
        minPerOrder: 1,
        maxPerOrder: 4,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'State of Women in AI',
    slug: 'state-of-women-in-ai-2026',
    description:
      'Panel + community Q&A on access, funding, and narratives. Hybrid: join in the room or dial in from anywhere.',
    type: EventType.HYBRID,
    venue: 'iHub Nairobi',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-06-07T08:00:00.000Z',
    endAt: '2026-06-07T11:00:00.000Z',
    bannerUrl: POSTER.womenAi,
    ticketTypes: [
      {
        name: 'In person',
        priceCents: 150000,
        currency: 'KES',
        quantityTotal: 180,
        quantitySold: 42,
        minPerOrder: 1,
        maxPerOrder: 3,
        status: TicketTypeStatus.ACTIVE,
      },
      {
        name: 'Online',
        priceCents: 75000,
        currency: 'KES',
        quantityTotal: 400,
        quantitySold: 58,
        minPerOrder: 1,
        maxPerOrder: 2,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Visioning Lab: Your 2026 North Star',
    slug: 'visioning-lab-2026-north-star',
    description:
      'Facilitated visioning for teams and solos—clarify priorities for climate work, careers, and community impact.',
    type: EventType.IN_PERSON,
    venue: 'KICC',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-06-20T07:30:00.000Z',
    endAt: '2026-06-20T12:00:00.000Z',
    bannerUrl: POSTER.visioning,
    ticketTypes: [
      {
        name: 'Standard',
        priceCents: 20000,
        currency: 'KES',
        quantityTotal: 600,
        quantitySold: 88,
        minPerOrder: 1,
        maxPerOrder: 5,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Wealth Blueprint Masterclass',
    slug: 'wealth-blueprint-masterclass-2026',
    description:
      'Micro-credentials, income stacks, and employers hiring for the next chapter—East Africa–focused.',
    type: EventType.VIRTUAL,
    venue: 'Microsoft Teams',
    city: 'Kampala',
    country: 'Uganda',
    startAt: '2026-07-05T13:00:00.000Z',
    endAt: '2026-07-05T15:00:00.000Z',
    bannerUrl: POSTER.wealth,
    ticketTypes: [
      {
        name: 'Participant',
        priceCents: 44900,
        currency: 'KES',
        quantityTotal: 900,
        quantitySold: 0,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Team Blueprint Workshop',
    slug: 'team-blueprint-workshop-2026',
    description:
      'Align your squad on roles, rituals, and a shared roadmap—facilitated working blocks for small teams and orgs.',
    type: EventType.HYBRID,
    venue: 'Strathmore University',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-07-18T09:00:00.000Z',
    endAt: '2026-07-18T12:30:00.000Z',
    bannerUrl: POSTER.blueprint,
    ticketTypes: [
      {
        name: 'Hall',
        priceCents: 35000,
        currency: 'KES',
        quantityTotal: 220,
        quantitySold: 61,
        status: TicketTypeStatus.ACTIVE,
      },
      {
        name: 'Stream',
        priceCents: 15000,
        currency: 'KES',
        quantityTotal: 350,
        quantitySold: 20,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Taxation Lab for Creators',
    slug: 'taxation-lab-for-creators-2026',
    description:
      'Receipts, timelines, and when to formalize—facilitated session with a practising advisor (educational only).',
    type: EventType.VIRTUAL,
    venue: 'Google Meet',
    city: 'Dar es Salaam',
    country: 'Tanzania',
    startAt: '2026-08-09T16:00:00.000Z',
    endAt: '2026-08-09T17:45:00.000Z',
    bannerUrl: POSTER.currency,
    ticketTypes: [
      {
        name: 'General admission',
        priceCents: 25000,
        currency: 'KES',
        quantityTotal: 500,
        quantitySold: 95,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Vision Your Pivot',
    slug: 'vision-your-pivot-2026',
    description:
      "Portfolio, referrals, and negotiation when you're changing cities or industries—built for first-time pivots.",
    type: EventType.IN_PERSON,
    venue: 'Nairobi Garage',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-08-29T06:00:00.000Z',
    endAt: '2026-08-30T16:00:00.000Z',
    bannerUrl: POSTER.visioning,
    ticketTypes: [
      {
        name: 'Full weekend',
        priceCents: 450000,
        currency: 'KES',
        quantityTotal: 80,
        quantitySold: 23,
        minPerOrder: 1,
        maxPerOrder: 2,
        status: TicketTypeStatus.ACTIVE,
      },
      {
        name: 'Sunday only',
        priceCents: 200000,
        currency: 'KES',
        quantityTotal: 40,
        quantitySold: 8,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
  {
    title: 'Give to Gain: Wellness Day',
    slug: 'give-to-gain-wellness-day-2026',
    description:
      'Movement, nutrition demos, and mental health triage in a festival layout—closing the season with energy.',
    type: EventType.IN_PERSON,
    venue: 'Karura Forest Gate A',
    city: 'Nairobi',
    country: 'Kenya',
    startAt: '2026-09-19T05:30:00.000Z',
    endAt: '2026-09-19T14:00:00.000Z',
    bannerUrl: POSTER.giveToGain,
    ticketTypes: [
      {
        name: 'Early bird',
        priceCents: 80000,
        currency: 'KES',
        quantityTotal: 200,
        quantitySold: 112,
        status: TicketTypeStatus.ACTIVE,
      },
      {
        name: 'Standard',
        priceCents: 120000,
        currency: 'KES',
        quantityTotal: 300,
        quantitySold: 14,
        status: TicketTypeStatus.ACTIVE,
      },
    ],
  },
].sort(
  (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
);
