/**
 * Removes seeded demo catalogue, smoke-test orders, and disposable test accounts
 * from the local/staging database.
 *
 * Run: npm run purge:smoke
 *
 * Preserves real organizer events (e.g. koroga, raven-event) and non-test users.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../src/database/data-source.factory';
import { DEMO_CATALOGUE_EVENTS } from './demo-catalogue-seed-data';

dotenv.config({ path: path.join(__dirname, '../.env') });

const DEMO_USER_EMAILS = [
  'demo-organizer@allaxs.demo',
  'demo-attendee@allaxs.demo',
  'demo-admin@allaxs.demo',
];

const DEMO_EVENT_SLUGS = DEMO_CATALOGUE_EVENTS.map((e) => e.slug);

async function main() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
  const demoSlugRows = await qr.query(
    `SELECT id, slug FROM events
     WHERE slug = ANY($1::text[])
        OR slug LIKE 'demo-checkout-live-%'
        OR slug LIKE 'demo-evt-%'
        OR slug LIKE '%smoke%'`,
    [DEMO_EVENT_SLUGS],
  );
  const demoEventIds: string[] = demoSlugRows.map(
    (r: { id: string }) => r.id,
  );

  const smokeOrderRows = await qr.query(
    `SELECT id FROM orders
     WHERE email ILIKE '%smoke%'
        OR email ILIKE '%@allaxs.demo'
        OR reference ILIKE 'seed_%'
        OR reference ILIKE 'pay_smoke%'
        OR ($1::uuid[] <> '{}' AND event_id = ANY($1::uuid[]))`,
    [demoEventIds],
  );
  const orderIds: string[] = smokeOrderRows.map((r: { id: string }) => r.id);

  const testUserRows = await qr.query(
    `SELECT id, email FROM users
     WHERE email = ANY($1::text[])
        OR email ~* '^guest-.+@example\\.com$'
        OR email ~* '^test-[0-9]+@example\\.com$'`,
    [DEMO_USER_EMAILS],
  );
  const testUserIds: string[] = testUserRows.map((r: { id: string }) => r.id);

  const keepEventSlugs = ['koroga', 'raven-event', 'sdf'];
  const fallbackOrganizer = await qr.query(
    `SELECT op.id FROM organizer_profiles op
     JOIN users u ON u.id = op.user_id
     WHERE u.email = 'freddy@youthplusafrica.com'
     LIMIT 1`,
  );
  const fallbackOrganizerId: string | null =
    fallbackOrganizer[0]?.id ?? null;

  if (fallbackOrganizerId) {
    const reassigned = await qr.query(
      `UPDATE events SET organizer_id = $1
       WHERE slug = ANY($2::text[])
       RETURNING slug`,
      [fallbackOrganizerId, keepEventSlugs],
    );
    if (reassigned.length > 0) {
      console.log('Reassigned real events to freddy@youthplusafrica.com:');
      reassigned.forEach((r: { slug?: string }) =>
        console.log(`    - ${r.slug ?? JSON.stringify(r)}`),
      );
    }
  } else {
    console.warn(
      'Warning: freddy@youthplusafrica.com profile not found — koroga/raven may be deleted with demo accounts.',
    );
  }

  console.log('Purge plan:');
  console.log(`  Demo/smoke events: ${demoSlugRows.length}`);
  demoSlugRows.forEach((r: { slug: string }) => console.log(`    - ${r.slug}`));
  console.log(`  Orders to remove: ${orderIds.length}`);
  console.log(`  Test users to remove: ${testUserRows.length}`);
  testUserRows.forEach((r: { email: string }) =>
    console.log(`    - ${r.email}`),
  );

  if (orderIds.length > 0) {
    await qr.query(
      `DELETE FROM checkins WHERE ticket_id IN (
         SELECT id FROM tickets WHERE order_id = ANY($1::uuid[])
       )`,
      [orderIds],
    );
    await qr.query(`DELETE FROM tickets WHERE order_id = ANY($1::uuid[])`, [
      orderIds,
    ]);
    await qr.query(
      `DELETE FROM coupon_redemptions WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    await qr.query(
      `DELETE FROM payment_installments WHERE plan_id IN (
         SELECT id FROM payment_plans WHERE order_id = ANY($1::uuid[])
       )`,
      [orderIds],
    );
    await qr.query(
      `DELETE FROM payment_plans WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    await qr.query(`DELETE FROM payments WHERE order_id = ANY($1::uuid[])`, [
      orderIds,
    ]);
    await qr.query(
      `DELETE FROM refund_requests WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    await qr.query(
      `DELETE FROM affiliate_conversions WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    await qr.query(
      `DELETE FROM organizer_ledger_entries WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    );
    await qr.query(`DELETE FROM order_items WHERE order_id = ANY($1::uuid[])`, [
      orderIds,
    ]);
    await qr.query(`DELETE FROM orders WHERE id = ANY($1::uuid[])`, [orderIds]);
  }

  if (demoEventIds.length > 0) {
    await qr.query(
      `DELETE FROM waitlist_entries WHERE event_id = ANY($1::uuid[])`,
      [demoEventIds],
    );
    await qr.query(
      `DELETE FROM scanner_sessions WHERE event_id = ANY($1::uuid[])`,
      [demoEventIds],
    );
    await qr.query(
      `DELETE FROM coupon_redemptions WHERE coupon_id IN (
         SELECT id FROM coupons WHERE event_id = ANY($1::uuid[])
       )`,
      [demoEventIds],
    );
    await qr.query(`DELETE FROM coupons WHERE event_id = ANY($1::uuid[])`, [
      demoEventIds,
    ]);
    await qr.query(
      `DELETE FROM affiliate_codes WHERE event_id = ANY($1::uuid[])`,
      [demoEventIds],
    );
    await qr.query(`DELETE FROM ticket_types WHERE event_id = ANY($1::uuid[])`, [
      demoEventIds,
    ]);
    await qr.query(`DELETE FROM events WHERE id = ANY($1::uuid[])`, [
      demoEventIds,
    ]);
  }

  if (testUserIds.length > 0) {
    const profileRows = await qr.query(
      `SELECT id FROM organizer_profiles WHERE user_id = ANY($1::uuid[])`,
      [testUserIds],
    );
    const profileIds: string[] = profileRows.map((r: { id: string }) => r.id);

    if (profileIds.length > 0) {
      await qr.query(
        `DELETE FROM payout_withdraw_requests WHERE organizer_profile_id = ANY($1::uuid[])`,
        [profileIds],
      );
      await qr.query(
        `DELETE FROM affiliate_conversions WHERE affiliate_code_id IN (
           SELECT id FROM affiliate_codes WHERE organizer_profile_id = ANY($1::uuid[])
         )`,
        [profileIds],
      );
      await qr.query(
        `DELETE FROM affiliate_codes WHERE organizer_profile_id = ANY($1::uuid[])`,
        [profileIds],
      );
      await qr.query(
        `DELETE FROM organizer_ledger_entries WHERE organizer_id = ANY($1::uuid[])`,
        [profileIds],
      );
      await qr.query(
        `DELETE FROM organization_invites WHERE organizer_profile_id = ANY($1::uuid[])`,
        [profileIds],
      );
      await qr.query(
        `DELETE FROM organization_members WHERE organizer_profile_id = ANY($1::uuid[])`,
        [profileIds],
      );
    }

    await qr.query(
      `DELETE FROM organization_members WHERE user_id = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(
      `DELETE FROM email_verifications WHERE "userId" = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(
      `DELETE FROM password_resets WHERE "userId" = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(
      `DELETE FROM refresh_tokens WHERE "userId" = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(
      `DELETE FROM tickets WHERE owner_user_id = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(
      `DELETE FROM organizer_profiles WHERE user_id = ANY($1::uuid[])`,
      [testUserIds],
    );
    await qr.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
      testUserIds,
    ]);
  }

  await qr.commitTransaction();

  const remainingEvents = await AppDataSource.query(
    `SELECT slug FROM events ORDER BY slug`,
  );
  const remainingUsers = await AppDataSource.query(
    `SELECT email FROM users ORDER BY email`,
  );
  const remainingOrders = await AppDataSource.query(
    `SELECT count(*)::int AS n FROM orders`,
  );

  console.log('\nPurge complete.');
  console.log(`  Remaining events (${remainingEvents.length}):`);
  remainingEvents.forEach((r: { slug: string }) =>
    console.log(`    - ${r.slug}`),
  );
  console.log(`  Remaining users (${remainingUsers.length}):`);
  remainingUsers.forEach((r: { email: string }) =>
    console.log(`    - ${r.email}`),
  );
  console.log(`  Remaining orders: ${remainingOrders[0]?.n ?? 0}`);
  } catch (error) {
    await qr.rollbackTransaction();
    throw error;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
});
