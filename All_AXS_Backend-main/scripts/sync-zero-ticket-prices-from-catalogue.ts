/**
 * Sets ticket_types.priceCents from the demo catalogue seed when the DB row
 * is still free (priceCents = 0). Matches event by slug and tier by name.
 * Unknown zero-priced tiers (not in DEMO_CATALOGUE_EVENTS) get 29900 KES.
 *
 * Run: npm run fix:ticket-prices
 * Dry run: npm run fix:ticket-prices -- --dry-run
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../src/database/data-source.factory';
import { Event } from '../src/events/entities/event.entity';
import { TicketType } from '../src/events/entities/ticket-type.entity';
import { DEMO_CATALOGUE_EVENTS } from './demo-catalogue-seed-data';

const FALLBACK_PRICE_CENTS = 29_900;

function parseArgs(argv: string[]) {
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  const { dryRun } = parseArgs(process.argv.slice(2));

  await AppDataSource.initialize();

  const eventsRepo = AppDataSource.getRepository(Event);
  const tiersRepo = AppDataSource.getRepository(TicketType);

  const zeroTiers = await tiersRepo.find({ where: { priceCents: 0 } });

  const updates: {
    tierId: string;
    slug: string;
    tierName: string;
    from: number;
    to: number;
    currency: string;
  }[] = [];

  for (const tier of zeroTiers) {
    const event = await eventsRepo.findOne({ where: { id: tier.eventId } });
    const slug = event?.slug ?? '(missing event)';
    const def = DEMO_CATALOGUE_EVENTS.find((d) => d.slug === event?.slug);
    const seedTier = def?.ticketTypes.find((t) => t.name === tier.name);
    const to = seedTier?.priceCents ?? FALLBACK_PRICE_CENTS;
    const currency = seedTier?.currency ?? tier.currency ?? 'KES';

    updates.push({
      tierId: tier.id,
      slug,
      tierName: tier.name,
      from: 0,
      to,
      currency,
    });
  }

  console.log(
    JSON.stringify(
      {
        message: dryRun
          ? 'Dry run — no ticket_types rows updated.'
          : 'Updating ticket_types.priceCents where price was 0',
        count: updates.length,
        updates,
      },
      null,
      2,
    ),
  );

  if (!dryRun) {
    for (const u of updates) {
      await tiersRepo.update(
        { id: u.tierId },
        { priceCents: u.to, currency: u.currency },
      );
    }
  }

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
