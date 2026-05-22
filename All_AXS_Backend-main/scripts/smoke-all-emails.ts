/**
 * Send every platform transactional email to one inbox (for design / Resend QA).
 *
 *   cd All_AXS_Backend-main
 *
 *   SMOKE_EMAIL_TO=you@example.com npm run smoke:all-emails
 *
 *
 * Non-interactive (mock Resend): DRY_RUN=1 npm run smoke:all-emails  OR  npm run smoke:ci:email-pdf
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../src/auth/services/email.service';
import { User } from '../src/users/entities/user.entity';
import { EventType, Role } from '../src/domain/enums';
import { TicketPdfService } from '../src/tickets/ticket-pdf.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

function mockUser(email: string): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email,
    name: 'Victor',
    passwordHash: undefined,
    roles: [Role.ATTENDEE],
    status: 'ACTIVE',
    orders: [],
    tickets: [],
    checkIns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;
}

async function main() {
  if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') {
    const { spawnSync } = require('child_process');
    const r = spawnSync('npm', ['run', 'smoke:ci:email-pdf'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env,
      shell: process.platform === 'win32',
    });
    process.exit(r.status ?? 1);
  }

  const to = (process.env.SMOKE_EMAIL_TO || process.argv[2])?.trim();
  if (!to) {
    console.error(
      'Missing recipient. Usage:\n  SMOKE_EMAIL_TO=you@gmail.com npm run smoke:all-emails',
    );
    process.exit(1);
  }

  const configService = new ConfigService();
  const emailService = new EmailService(
    configService,
    new TicketPdfService(configService),
  );
  const user = mockUser(to);
  const demoToken = 'smoke-test-token-' + Date.now();

  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: '1/9 Email verification',
      run: () => emailService.sendVerificationEmail(user, demoToken),
    },
    {
      label: '2/9 Password reset link',
      run: () => emailService.sendPasswordResetEmail(user, demoToken),
    },
    {
      label: '3/9 Password reset confirmation',
      run: () => emailService.sendPasswordResetConfirmationEmail(user),
    },
    {
      label: '4/9 Password change confirmation',
      run: () => emailService.sendPasswordChangeConfirmationEmail(user),
    },
    {
      label: '5/9 Welcome (post-verify)',
      run: () => emailService.sendWelcomeEmail(user),
    },
    {
      label: '6/9 Event submitted — organizer',
      run: () =>
        emailService.sendEventSubmittedForReviewEmail({
          to,
          recipientName: user.name,
          eventTitle: 'Smoke Test Summit',
          eventId: '00000000-0000-4000-8000-0000000000e1',
          orgName: 'Smoke Org',
          venue: 'KICC Grounds',
          startAt: new Date(Date.now() + 14 * 86400000),
          audience: 'organizer',
        }),
    },
    {
      label: '7/9 Event submitted — admin',
      run: () =>
        emailService.sendEventSubmittedForReviewEmail({
          to,
          recipientName: 'Demo Admin',
          eventTitle: 'Smoke Test Summit',
          eventId: '00000000-0000-4000-8000-0000000000e1',
          orgName: 'Smoke Org',
          venue: 'KICC Grounds',
          startAt: new Date(Date.now() + 14 * 86400000),
          audience: 'admin',
        }),
    },
    {
      label: '8/9 Ticket / order confirmation',
      run: () =>
        emailService.sendTicketEmail({
          buyerName: user.name ?? 'Guest',
          buyerEmail: to,
          eventTitle: 'Smoke Test Concert',
          event: {
            title: 'Smoke Test Concert',
            slug: 'smoke-test-concert',
            startAt: new Date(Date.now() + 7 * 86400000),
            endAt: new Date(Date.now() + 7 * 86400000 + 3 * 3600000),
            venue: 'KICC Grounds',
            city: 'Nairobi',
            country: 'Kenya',
            type: EventType.IN_PERSON,
            organizerName: 'All AXS Demo',
          },
          tickets: [
            {
              id: '00000000-0000-4000-8000-000000000099',
              tierName: 'General Admission',
              qrNonce: 'smoke-nonce-abc123',
              qrSignature: 'smoke-signature-def456',
              issuedAt: new Date(),
            },
          ],
          summary: {
            subtotalCents: 250000,
            discountCents: 50000,
            totalCents: 200000,
            currency: 'KES',
            couponCode: 'SMOKE50',
          },
        }),
    },
    {
      label: '9/9 Order refund confirmation',
      run: () =>
        emailService.sendOrderRefundEmail({
          buyerEmail: to,
          buyerName: user.name,
          orderReference: 'SMOKE-REF-001',
          eventTitle: 'Smoke Test Concert',
          refundAmountCents: 200000,
          currency: 'KES',
        }),
    },
  ];

  console.log(`Sending ${steps.length} emails to ${to}…\n`);

  for (const step of steps) {
    console.log(`→ ${step.label}`);
    await step.run();
    console.log(`  ✓ sent\n`);
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('All done. Check inbox and spam.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
