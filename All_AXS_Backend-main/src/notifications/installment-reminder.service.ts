import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  PaymentInstallment,
  PaymentInstallmentStatus,
} from '../domain/payment-installment.entity';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type InstallmentReminderRunResult = {
  sent: number;
  skipped: number;
  markedOverdue: number;
};

type ReminderCandidateRow = {
  installment_id: string;
  sequence: number;
  amount: number;
  due_at: Date;
  installment_status: PaymentInstallmentStatus;
  last_reminder_sent_at: Date | null;
  currency: string;
  order_id: string;
  buyer_email: string;
  event_title: string;
  buyer_name: string | null;
};

@Injectable()
export class InstallmentReminderService {
  private readonly logger = new Logger(InstallmentReminderService.name);

  constructor(
    @InjectRepository(PaymentInstallment)
    private readonly installmentRepository: Repository<PaymentInstallment>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async processDueReminders(): Promise<InstallmentReminderRunResult> {
    const now = new Date();
    const result: InstallmentReminderRunResult = {
      sent: 0,
      skipped: 0,
      markedOverdue: 0,
    };

    const rows = await this.installmentRepository.query<ReminderCandidateRow[]>(
      `
        SELECT
          i.id AS installment_id,
          i.sequence AS sequence,
          i.amount AS amount,
          i."dueAt" AS due_at,
          i.status AS installment_status,
          i.last_reminder_sent_at AS last_reminder_sent_at,
          p.currency AS currency,
          o.id AS order_id,
          o.email AS buyer_email,
          e.title AS event_title,
          u.name AS buyer_name
        FROM payment_installments i
        INNER JOIN payment_plans p ON p.id = i.plan_id
        INNER JOIN orders o ON o.id = p.order_id
        INNER JOIN events e ON e.id = o.event_id
        LEFT JOIN users u ON u.id = o.user_id
        WHERE p.status = 'ACTIVE'
          AND i.status IN ('PENDING', 'OVERDUE')
          AND o.status != 'CANCELLED'
      `,
    );

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    for (const row of rows) {
      const dueAt = new Date(row.due_at);
      let status = row.installment_status;

      if (
        status === PaymentInstallmentStatus.PENDING &&
        dueAt.getTime() < now.getTime()
      ) {
        await this.installmentRepository.update(
          { id: row.installment_id },
          { status: PaymentInstallmentStatus.OVERDUE },
        );
        status = PaymentInstallmentStatus.OVERDUE;
        result.markedOverdue += 1;
      }

      const msUntilDue = dueAt.getTime() - now.getTime();
      if (msUntilDue > THREE_DAYS_MS) {
        result.skipped += 1;
        continue;
      }

      const isOverdue = msUntilDue < 0;
      const lastSentAt = row.last_reminder_sent_at
        ? new Date(row.last_reminder_sent_at).getTime()
        : 0;
      const msSinceLast = lastSentAt ? now.getTime() - lastSentAt : Infinity;

      const shouldSend =
        !row.last_reminder_sent_at ||
        (isOverdue && msSinceLast >= SEVEN_DAYS_MS) ||
        (!isOverdue && msSinceLast >= ONE_DAY_MS);

      if (!shouldSend) {
        result.skipped += 1;
        continue;
      }

      const buyerEmail = row.buyer_email;
      const allowReminders =
        await this.usersService.shouldSendReminders(buyerEmail);
      if (!allowReminders) {
        await this.installmentRepository.update(
          { id: row.installment_id },
          { lastReminderSentAt: now },
        );
        result.skipped += 1;
        continue;
      }

      const orderUrl = `${frontendUrl}/dashboard/orders/${row.order_id}`;

      await this.notificationsService.dispatchInstallmentDueReminder({
        buyerEmail,
        buyerName: row.buyer_name,
        eventTitle: row.event_title,
        amountCents: row.amount,
        currency: row.currency,
        dueAt,
        sequence: row.sequence,
        isOverdue,
        orderId: row.order_id,
        orderUrl,
      });

      await this.installmentRepository.update(
        { id: row.installment_id },
        { lastReminderSentAt: now },
      );
      result.sent += 1;
    }

    this.logger.log(
      `Installment reminders: ${result.sent} sent, ${result.skipped} skipped, ${result.markedOverdue} marked overdue`,
    );
    return result;
  }
}
