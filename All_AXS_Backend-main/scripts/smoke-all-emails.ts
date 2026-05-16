/**
 * Send every platform transactional email to one inbox (for design / Resend QA).
 *
 *   cd All_AXS_Backend-main
 *   SMOKE_EMAIL_TO=vichumo38@gmail.com npm run smoke:all-emails
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
      label: '1/5 Email verification',
      run: () => emailService.sendVerificationEmail(user, demoToken),
    },
    {
      label: '2/5 Password reset link',
      run: () => emailService.sendPasswordResetEmail(user, demoToken),
    },
    {
      label: '3/5 Password reset confirmation',
      run: () => emailService.sendPasswordResetConfirmationEmail(user),
    },
    {
      label: '4/5 Welcome (post-verify)',
      run: () => emailService.sendWelcomeEmail(user),
    },
    {
      label: '5/5 Ticket / order confirmation',
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
