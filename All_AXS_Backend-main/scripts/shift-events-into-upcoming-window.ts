/**
 * Remaps existing events into a rolling UTC window (default: next 21 days from
 * "today" at script run time) while preserving each event's duration and the
 * relative spacing of start times across the catalogue.
 *
 * Run from API repo root:
 *   npm run shift:events:3w
 *   npm run shift:events:3w -- --dry-run
 *   npm run shift:events:3w -- --include-drafts
 *
 * By default only PUBLISHED events are updated (what the public calendar lists).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../src/database/data-source.factory';
import { Event } from '../src/events/entities/event.entity';
import { EventStatus } from '../src/domain/enums';

const MS_PER_DAY = 86_400_000;

function utcStartOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const includeDrafts = argv.includes('--include-drafts');
  const daysArg = argv.find((a) => a.startsWith('--days='));
  const days = daysArg
    ? Math.max(1, Number.parseInt(daysArg.split('=')[1] ?? '21', 10) || 21)
    : 21;
  return { dryRun, includeDrafts, days };
}

async function main() {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  const { dryRun, includeDrafts, days } = parseArgs(process.argv.slice(2));

  await AppDataSource.initialize();

  const repo = AppDataSource.getRepository(Event);

  const events = await repo.find({
    ...(includeDrafts ? {} : { where: { status: EventStatus.PUBLISHED } }),
    order: { startAt: 'ASC' },
  });

  if (events.length === 0) {
    console.log(
      JSON.stringify(
        {
          message: 'No events matched filters; nothing to update.',
          filters: includeDrafts ? { status: 'ALL' } : { status: 'PUBLISHED' },
        },
        null,
        2,
      ),
    );
    await AppDataSource.destroy();
    return;
  }

  const now = new Date();
  const windowStart = utcStartOfDay(now);
  const windowEnd = new Date(windowStart.getTime() + days * MS_PER_DAY);

  const durations = events.map((e) =>
    Math.max(0, e.endAt.getTime() - e.startAt.getTime()),
  );
  const maxDur = Math.max(...durations, 60_000);
  const innerEnd = new Date(windowEnd.getTime() - maxDur);
  if (innerEnd.getTime() <= windowStart.getTime()) {
    throw new Error(
      `Window too small for longest event duration (${maxDur} ms) in ${days} day(s).`,
    );
  }

  const starts = events.map((e) => e.startAt.getTime());
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);
  const span = maxStart - minStart;
  const targetLo = windowStart.getTime();
  const targetHi = innerEnd.getTime();

  const updates: { id: string; title: string; startAt: Date; endAt: Date }[] =
    [];

  if (span === 0) {
    const n = events.length;
    for (let i = 0; i < n; i++) {
      const t =
        n === 1
          ? targetLo + (targetHi - targetLo) / 2
          : targetLo + (i / (n - 1)) * (targetHi - targetLo);
      const e = events[i];
      const dur = durations[i];
      const startAt = new Date(t);
      const endAt = new Date(t + dur);
      updates.push({ id: e.id, title: e.title, startAt, endAt });
    }
  } else {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const dur = durations[i];
      const ratio = (e.startAt.getTime() - minStart) / span;
      const t = targetLo + ratio * (targetHi - targetLo);
      const startAt = new Date(t);
      const endAt = new Date(t + dur);
      updates.push({ id: e.id, title: e.title, startAt, endAt });
    }
  }

  const preview = updates.slice(0, 8).map((u) => ({
    id: u.id,
    title: u.title,
    startAt: u.startAt.toISOString(),
    endAt: u.endAt.toISOString(),
  }));

  console.log(
    JSON.stringify(
      {
        message: dryRun
          ? 'Dry run — no rows written.'
          : 'Updating events.startAt / events.endAt',
        window: {
          days,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        },
        filters: includeDrafts ? { status: 'ALL' } : { status: 'PUBLISHED' },
        eventCount: updates.length,
        preview,
      },
      null,
      2,
    ),
  );

  if (!dryRun) {
    for (const u of updates) {
      await repo.update({ id: u.id }, { startAt: u.startAt, endAt: u.endAt });
    }
  }

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
