/**
 * Ensures comp + installment E2E fixtures exist for fan smoke tests.
 * Run: npm run ensure:fan-e2e-fixtures
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppDataSource } from '../src/database/data-source.factory';
import { User } from '../src/users/entities/user.entity';
import { Event } from '../src/events/entities/event.entity';
import { TicketType } from '../src/events/entities/ticket-type.entity';
import { Order } from '../src/domain/order.entity';
import { OrderItem } from '../src/domain/order-item.entity';
import {
  OrderStatus,
  TicketTypeStatus,
} from '../src/domain/enums';
import { PaymentPlan, PaymentPlanStatus } from '../src/domain/payment-plan.entity';
import {
  PaymentInstallment,
  PaymentInstallmentStatus,
} from '../src/domain/payment-installment.entity';
import { EmailVerification } from '../src/auth/entities/email-verification.entity';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ATT_EMAIL = 'demo-attendee@allaxs.demo';
const EVENT_SLUG = 'blueprint-map-your-next-move-2026';
export const DEMO_COMP_TOKEN = 'demo-comp-e2e-fixture';

async function main() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const attendee = await userRepo.findOne({ where: { email: ATT_EMAIL } });
  if (!attendee) {
    throw new Error(`Missing ${ATT_EMAIL} — run npm run seed:demo first`);
  }

  // Mark email verified for installment checkout tests
  const evRepo = AppDataSource.getRepository(EmailVerification);
  const verified = await evRepo.findOne({
    where: { userId: attendee.id, isUsed: true },
  });
  if (!verified) {
    await evRepo.save(
      evRepo.create({
        userId: attendee.id,
        email: attendee.email,
        token: `seed_verified_${attendee.id.slice(0, 8)}`,
        expiresAt: new Date(Date.now() + 86400000),
        isUsed: true,
        usedAt: new Date(),
      }),
    );
    console.log('Marked demo attendee email as verified');
  }

  const event = await AppDataSource.getRepository(Event).findOne({
    where: { slug: EVENT_SLUG },
  });
  if (!event) {
    throw new Error(`Missing event slug ${EVENT_SLUG}`);
  }

  let compTier = await AppDataSource.getRepository(TicketType).findOne({
    where: { eventId: event.id, compLinkToken: DEMO_COMP_TOKEN },
  });
  if (!compTier) {
    compTier = AppDataSource.getRepository(TicketType).create({
      eventId: event.id,
      name: 'VIP Comp (E2E)',
      description: 'Hidden comp tier for fan dashboard E2E tests',
      priceCents: 0,
      currency: 'KES',
      quantityTotal: 50,
      quantitySold: 0,
      status: TicketTypeStatus.ACTIVE,
      isHidden: true,
      compLinkToken: DEMO_COMP_TOKEN,
      allowInstallments: false,
    });
    compTier = await AppDataSource.getRepository(TicketType).save(compTier);
    console.log(`Created comp tier ${compTier.id} token=${DEMO_COMP_TOKEN}`);
  } else {
    console.log(`Comp tier already exists token=${DEMO_COMP_TOKEN}`);
  }

  const pendingOrder = await AppDataSource.getRepository(Order).findOne({
    where: { userId: attendee.id, status: OrderStatus.PENDING },
    relations: ['items'],
    order: { createdAt: 'DESC' },
  });

  if (pendingOrder && pendingOrder.items?.length) {
    const existingPlan = await AppDataSource.getRepository(PaymentPlan).findOne({
      where: { orderId: pendingOrder.id },
      relations: ['installments'],
    });
    if (!existingPlan) {
      const item = pendingOrder.items[0];
      const total = pendingOrder.amountCents || item.unitPriceCents * item.qty;
      const plan = await AppDataSource.getRepository(PaymentPlan).save(
        AppDataSource.getRepository(PaymentPlan).create({
          orderId: pendingOrder.id,
          ticketTypeId: item.ticketTypeId,
          totalAmount: total,
          currency: pendingOrder.currency,
          status: PaymentPlanStatus.ACTIVE,
          gracePeriodDays: 7,
          autoCancelOnDefault: false,
        }),
      );
      const firstAmount = Math.round(total * 0.4);
      const secondAmount = total - firstAmount;
      const now = new Date();
      await AppDataSource.getRepository(PaymentInstallment).save([
        {
          planId: plan.id,
          sequence: 1,
          amount: firstAmount,
          pct: 40,
          dueAt: now,
          status: PaymentInstallmentStatus.PAID,
          paidAt: now,
        },
        {
          planId: plan.id,
          sequence: 2,
          amount: secondAmount,
          pct: 60,
          dueAt: new Date(now.getTime() + 14 * 86400000),
          status: PaymentInstallmentStatus.PENDING,
        },
      ].map((row) => AppDataSource.getRepository(PaymentInstallment).create(row)));
      console.log(`Created payment plan on order ${pendingOrder.id} (2nd installment pending)`);
    } else {
      console.log(`Payment plan already on order ${pendingOrder.id}`);
    }
  } else {
    console.log('No pending order with items — installment fixture skipped');
  }

  await AppDataSource.destroy();
  console.log('Fan E2E fixtures ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
