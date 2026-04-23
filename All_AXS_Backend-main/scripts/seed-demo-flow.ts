/**
 * Demo seed: demo organizer (with profile), demo attendee, full public catalogue
 * (same events + `/posters/*` art as the web `DEMO_PUBLIC_EVENTS` fixtures).
 *
 * Run from API repo root: npm run seed:demo
 *
 * Idempotent: creates users once; syncs catalogue by stable slug (insert or update
 * event fields; replaces ticket types only when the tier set changed). Also ensures
 * one PAID order + ticket for demo-attendee@allaxs.demo (stable order.reference) so
 * GET /tickets/me is populated without running checkout.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppDataSource } from '../src/database/data-source.factory';
import { User } from '../src/users/entities/user.entity';
import { OrganizerProfile } from '../src/users/entities/organizer-profile.entity';
import { Event } from '../src/events/entities/event.entity';
import { TicketType } from '../src/events/entities/ticket-type.entity';
import { Order } from '../src/domain/order.entity';
import { OrderItem } from '../src/domain/order-item.entity';
import { Ticket } from '../src/domain/ticket.entity';
import { Payment } from '../src/domain/payment.entity';
import {
  EventStatus,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  Role,
  TicketTypeStatus,
} from '../src/domain/enums';
import { DEMO_CATALOGUE_EVENTS } from './demo-catalogue-seed-data';

const ORG_EMAIL = 'demo-organizer@allaxs.demo';
const ATT_EMAIL = 'demo-attendee@allaxs.demo';
const PASSWORD = 'DemoFlow123!';

/** Stable idempotency key — one seeded PAID order + ticket for the demo attendee wallet. */
const SEED_ATTENDEE_WALLET_ORDER_REF = 'seed_demo_attendee_wallet';

/**
 * Ensures `demo-attendee@allaxs.demo` has at least one issued ticket in the DB so
 * `GET /tickets/me` is non-empty when the web app uses API checkout.
 * Catalogue seed alone only creates events + tiers, not purchases.
 */
async function ensureDemoAttendeeSeededTicket(
  attendee: User,
  catalogueEventId: string,
): Promise<{ created: boolean; orderId?: string; ticketId?: string }> {
  const existing = await AppDataSource.getRepository(Order).findOne({
    where: { reference: SEED_ATTENDEE_WALLET_ORDER_REF },
  });
  if (existing) {
    return { created: false, orderId: existing.id };
  }

  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

  return AppDataSource.transaction(async (manager) => {
    const dup = await manager.findOne(Order, {
      where: { reference: SEED_ATTENDEE_WALLET_ORDER_REF },
    });
    if (dup) {
      return { created: false, orderId: dup.id };
    }

    const event = await manager.findOne(Event, { where: { id: catalogueEventId } });
    if (!event) {
      throw new Error(`Seed wallet: event "${catalogueEventId}" not found.`);
    }

    const tierRows = await manager.find(TicketType, {
      where: { eventId: catalogueEventId },
      order: { createdAt: 'ASC' },
    });
    if (!tierRows.length) {
      throw new Error(
        `Seed wallet: event "${catalogueEventId}" has no ticket_types rows — catalogue sync may have failed.`,
      );
    }

    const tier =
      tierRows.find((t) => t.status === TicketTypeStatus.ACTIVE) ?? tierRows[0];
    const locked = await manager.findOne(TicketType, {
      where: { id: tier.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) {
      throw new Error(`Seed wallet: ticket type ${tier.id} not found`);
    }
    const remaining = locked.quantityTotal - locked.quantitySold;
    if (remaining < 1) {
      throw new Error(
        `Seed wallet: no inventory left on tier "${locked.name}" for event "${event.slug}"`,
      );
    }

    const totalCents = locked.priceCents;
    const order = manager.create(Order, {
      userId: attendee.id,
      eventId: event.id,
      status: OrderStatus.PAID,
      amountCents: totalCents,
      feesCents: 0,
      currency: locked.currency,
      reference: SEED_ATTENDEE_WALLET_ORDER_REF,
      email: attendee.email,
      phone: undefined,
      notes: JSON.stringify({ demo: true, seed: true, buyerName: attendee.name }),
    });
    await manager.save(order);

    const item = manager.create(OrderItem, {
      orderId: order.id,
      ticketTypeId: locked.id,
      qty: 1,
      unitPriceCents: locked.priceCents,
      currency: locked.currency,
    });
    await manager.save(item);

    locked.quantitySold += 1;
    await manager.save(locked);

    const payment = manager.create(Payment, {
      orderId: order.id,
      gateway: PaymentGateway.PAYSTACK,
      intentId: `seed_wallet_${crypto.randomUUID()}`,
      status: PaymentStatus.SUCCESS,
      amountCents: totalCents,
      currency: order.currency,
      rawPayload: { demo: true, seed: true },
    });
    await manager.save(payment);

    const qrNonce = `qr_${crypto.randomUUID().replace(/-/g, '')}`;
    const ticket = manager.create(Ticket, {
      orderId: order.id,
      ticketTypeId: locked.id,
      ownerUserId: attendee.id,
      attendeeName: attendee.name,
      attendeeEmail: attendee.email,
      qrNonce,
      qrSignature: '',
    });
    await manager.save(ticket);
    const sig = crypto.createHmac('sha256', jwtSecret).update(`${ticket.id}:${qrNonce}`).digest('hex');
    ticket.qrSignature = sig;
    await manager.save(ticket);

    return { created: true, orderId: order.id, ticketId: ticket.id };
  });
}

async function syncCatalogueEvents(
  profile: OrganizerProfile,
  eventsRepo: ReturnType<typeof AppDataSource.getRepository<Event>>,
  tiersRepo: ReturnType<typeof AppDataSource.getRepository<TicketType>>,
): Promise<{
  created: number;
  updated: number;
  slugs: string[];
  /** First catalogue event id (for attendee wallet seed). */
  walletCatalogueEventId: string | null;
}> {
  let created = 0;
  let updated = 0;
  const slugs: string[] = [];
  const firstCatalogueSlug = DEMO_CATALOGUE_EVENTS[0]?.slug ?? null;
  let walletCatalogueEventId: string | null = null;

  for (const def of DEMO_CATALOGUE_EVENTS) {
    slugs.push(def.slug);
    let event = await eventsRepo.findOne({
      where: { slug: def.slug, organizer: { id: profile.id } },
      relations: ['ticketTypes'],
    });

    if (!event) {
      event = eventsRepo.create({
        organizer: profile,
        title: def.title,
        slug: def.slug,
        description: def.description,
        bannerUrl: def.bannerUrl,
        venue: def.venue,
        city: def.city,
        country: def.country,
        startAt: new Date(def.startAt),
        endAt: new Date(def.endAt),
        type: def.type,
        status: EventStatus.PUBLISHED,
        isPublic: true,
      });
      await eventsRepo.save(event);
      created++;
    } else {
      event.title = def.title;
      event.description = def.description;
      event.bannerUrl = def.bannerUrl;
      event.venue = def.venue;
      event.city = def.city;
      event.country = def.country;
      event.startAt = new Date(def.startAt);
      event.endAt = new Date(def.endAt);
      event.type = def.type;
      event.status = EventStatus.PUBLISHED;
      event.isPublic = true;
      await eventsRepo.save(event);
      updated++;
    }

    const existingCount = await tiersRepo.count({ where: { eventId: event.id } });
    if (existingCount > 0) {
      await tiersRepo.delete({ eventId: event.id });
    }

    for (const t of def.ticketTypes) {
      const row = tiersRepo.create({
        eventId: event.id,
        name: t.name,
        description: t.description,
        priceCents: t.priceCents,
        currency: t.currency,
        quantityTotal: t.quantityTotal,
        quantitySold: t.quantitySold,
        minPerOrder: t.minPerOrder ?? 1,
        ...(t.maxPerOrder != null ? { maxPerOrder: t.maxPerOrder } : {}),
        status: t.status ?? TicketTypeStatus.ACTIVE,
        allowInstallments: false,
      });
      await tiersRepo.save(row);
    }

    if (firstCatalogueSlug && def.slug === firstCatalogueSlug) {
      walletCatalogueEventId = event.id;
    }
  }

  return { created, updated, slugs, walletCatalogueEventId };
}

async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env') });

  await AppDataSource.initialize();

  const users = AppDataSource.getRepository(User);
  const profiles = AppDataSource.getRepository(OrganizerProfile);
  const events = AppDataSource.getRepository(Event);
  const tiers = AppDataSource.getRepository(TicketType);

  let organizerUser = await users.findOne({ where: { email: ORG_EMAIL } });
  let profile: OrganizerProfile | null = null;

  if (!organizerUser) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    organizerUser = users.create({
      email: ORG_EMAIL,
      name: 'Demo Organizer',
      passwordHash: hash,
      roles: [Role.ATTENDEE, Role.ORGANIZER],
    });
    await users.save(organizerUser);

    profile = profiles.create({
      userId: organizerUser.id,
      orgName: 'Demo Organizer',
      supportEmail: 'support@demo.allaxs',
      verified: true,
    });
    await profiles.save(profile);

    const attendeeUser = users.create({
      email: ATT_EMAIL,
      name: 'Demo Attendee',
      passwordHash: hash,
      roles: [Role.ATTENDEE],
    });
    await users.save(attendeeUser);
  } else {
    profile = await profiles.findOne({
      where: { userId: organizerUser.id },
    });
    if (!profile) {
      profile = profiles.create({
        userId: organizerUser.id,
        orgName: 'Demo Organizer',
        supportEmail: 'support@demo.allaxs',
        verified: true,
      });
      await profiles.save(profile);
    } else if (profile.orgName !== 'Demo Organizer') {
      profile.orgName = 'Demo Organizer';
      await profiles.save(profile);
    }

    const attendee = await users.findOne({ where: { email: ATT_EMAIL } });
    if (!attendee) {
      const hash = await bcrypt.hash(PASSWORD, 10);
      await users.save(
        users.create({
          email: ATT_EMAIL,
          name: 'Demo Attendee',
          passwordHash: hash,
          roles: [Role.ATTENDEE],
        }),
      );
    }
  }

  if (!profile) {
    throw new Error('Organizer profile missing after seed step');
  }

  const sync = await syncCatalogueEvents(profile, events, tiers);

  const attendeeUser = await users.findOne({ where: { email: ATT_EMAIL } });
  if (!attendeeUser) {
    throw new Error(`Demo attendee ${ATT_EMAIL} missing after seed; cannot seed wallet ticket`);
  }
  if (!sync.walletCatalogueEventId) {
    throw new Error('Catalogue seed returned no wallet event id (empty DEMO_CATALOGUE_EVENTS?)');
  }
  const walletSeed = await ensureDemoAttendeeSeededTicket(attendeeUser, sync.walletCatalogueEventId);

  console.log(
    JSON.stringify(
      {
        message: 'Demo catalogue synced',
        organizer: { email: ORG_EMAIL, password: PASSWORD, userId: organizerUser.id },
        attendee: { email: ATT_EMAIL, password: PASSWORD, userId: attendeeUser.id },
        profileId: profile.id,
        catalogue: {
          eventCount: DEMO_CATALOGUE_EVENTS.length,
          eventsCreated: sync.created,
          eventsUpdated: sync.updated,
          slugs: sync.slugs,
        },
        demoAttendeeWallet: {
          ...walletSeed,
          orderReference: SEED_ATTENDEE_WALLET_ORDER_REF,
          note: walletSeed.created
            ? 'Created one demo ticket for the first catalogue event.'
            : walletSeed.orderId
              ? 'Wallet seed already applied (idempotent).'
              : 'No wallet ticket created (empty catalogue).',
        },
        postersNote:
          'bannerUrl values are Next.js public paths (e.g. /posters/...). They match the web app public/posters assets.',
        nextSteps: [
          'Web: NEXT_PUBLIC_USE_DEMO_EVENTS=false to list these from the API',
          'Web: ensure NEXT_PUBLIC_SITE_URL points at the Next origin so /posters URLs resolve',
          'Web: NEXT_PUBLIC_USE_API_CHECKOUT=true so My tickets calls GET /api/tickets/me (database). Otherwise passes only appear after browser checkout (sessionStorage).',
        ],
      },
      null,
      2,
    ),
  );

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
