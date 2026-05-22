/**
 * Non-interactive smoke: build all transactional email HTML + ticket PDFs
 * without calling the Resend API. Safe for CI (no live RESEND_API_KEY required).
 *
 *   npm run smoke:ci:email-pdf
 *   DRY_RUN=1 npm run smoke:all-emails   # delegates here
 *
 * Skip: set SKIP_EMAIL_PDF_SMOKE=1
 */
import * as Module from 'module';
import { ConfigService } from '@nestjs/config';
import { EventType, Role } from '../src/domain/enums';
import { User } from '../src/users/entities/user.entity';

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (id === 'resend') {
    return {
      Resend: class MockResend {
        emails = {
          send: async () =>
            ({ data: { id: 'ci-dry-run' }, error: null }) as const,
        };
      },
    };
  }
  return (originalRequire as NodeRequire).apply(this, [id, ...args]);
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EmailService } = require('../src/auth/services/email.service') as {
  EmailService: typeof import('../src/auth/services/email.service').EmailService;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TicketPdfService } = require('../src/tickets/ticket-pdf.service') as {
  TicketPdfService: typeof import('../src/tickets/ticket-pdf.service').TicketPdfService;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ticketToPdfContent } = require('../src/tickets/ticket-email.util') as {
  ticketToPdfContent: typeof import('../src/tickets/ticket-email.util').ticketToPdfContent;
};

function mockUser(email: string): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email,
    name: 'CI Smoke',
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

function assertPdfBuffer(buf: Buffer, label: string): void {
  const head = buf.subarray(0, 5).toString('ascii');
  if (head !== '%PDF-') {
    throw new Error(`${label}: expected PDF header, got ${head.slice(0, 8)}`);
  }
  if (buf.length < 500) {
    throw new Error(`${label}: PDF buffer suspiciously small (${buf.length} bytes)`);
  }
}

async function main(): Promise<void> {
  if (process.env.SKIP_EMAIL_PDF_SMOKE === '1') {
    console.log('SKIP_EMAIL_PDF_SMOKE=1 — skipping email/PDF smoke');
    return;
  }

  const to = (process.env.SMOKE_EMAIL_TO || 'ci-smoke@example.com').trim();
  const config = new ConfigService({
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: process.env.RESEND_API_KEY || 're_ci_dummy_not_sent',
    RESEND_FROM: process.env.RESEND_FROM || 'onboarding@resend.dev',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    APP_NAME: process.env.APP_NAME || 'All AXS',
    NODE_ENV: process.env.NODE_ENV || 'test',
  });

  const ticketPdfService = new TicketPdfService(config);
  const emailService = new EmailService(config, ticketPdfService);
  const user = mockUser(to);
  const demoToken = 'ci-smoke-token';

  const pdfContent = ticketToPdfContent(
    {
      id: '00000000-0000-4000-8000-000000000099',
      tierName: 'General Admission',
      qrNonce: 'ci-nonce',
      qrSignature: 'ci-signature',
      issuedAt: new Date(),
    },
    {
      title: 'CI Smoke Concert',
      slug: 'ci-smoke-concert',
      startAt: new Date(Date.now() + 7 * 86400000),
      endAt: new Date(Date.now() + 7 * 86400000 + 3 * 3600000),
      venue: 'KICC Grounds',
      city: 'Nairobi',
      country: 'Kenya',
      type: EventType.IN_PERSON,
      organizerName: 'All AXS',
    },
    to,
  );
  const pdfBuffer = await ticketPdfService.buildTicketPdfBuffer(pdfContent);
  assertPdfBuffer(pdfBuffer, 'TicketPdfService.buildTicketPdfBuffer');
  console.log(`✓ Ticket PDF (${pdfBuffer.length} bytes)`);

  const steps: { label: string; run: () => Promise<void> }[] = [
    {
      label: 'verification email',
      run: () => emailService.sendVerificationEmail(user, demoToken),
    },
    {
      label: 'password reset',
      run: () => emailService.sendPasswordResetEmail(user, demoToken),
    },
    {
      label: 'password reset confirmation',
      run: () => emailService.sendPasswordResetConfirmationEmail(user),
    },
    { label: 'welcome email', run: () => emailService.sendWelcomeEmail(user) },
    {
      label: 'event submitted (organizer)',
      run: () =>
        emailService.sendEventSubmittedForReviewEmail({
          to,
          recipientName: user.name,
          eventTitle: 'CI Smoke Summit',
          eventId: '00000000-0000-4000-8000-0000000000e1',
          orgName: 'Smoke Org',
          venue: 'KICC',
          startAt: new Date(Date.now() + 14 * 86400000),
          audience: 'organizer',
        }),
    },
    {
      label: 'event submitted (admin)',
      run: () =>
        emailService.sendEventSubmittedForReviewEmail({
          to,
          recipientName: 'Admin',
          eventTitle: 'CI Smoke Summit',
          eventId: '00000000-0000-4000-8000-0000000000e1',
          orgName: 'Smoke Org',
          venue: 'KICC',
          startAt: new Date(Date.now() + 14 * 86400000),
          audience: 'admin',
        }),
    },
    {
      label: 'ticket / order confirmation (HTML + PDF attach)',
      run: () =>
        emailService.sendTicketEmail({
          buyerName: user.name ?? 'Guest',
          buyerEmail: to,
          eventTitle: 'CI Smoke Concert',
          event: {
            title: 'CI Smoke Concert',
            slug: 'ci-smoke-concert',
            startAt: new Date(Date.now() + 7 * 86400000),
            endAt: new Date(Date.now() + 7 * 86400000 + 3 * 3600000),
            venue: 'KICC Grounds',
            city: 'Nairobi',
            country: 'Kenya',
            type: EventType.IN_PERSON,
            organizerName: 'All AXS',
          },
          tickets: [
            {
              id: '00000000-0000-4000-8000-000000000099',
              tierName: 'General Admission',
              qrNonce: 'ci-nonce',
              qrSignature: 'ci-signature',
              issuedAt: new Date(),
            },
          ],
          summary: {
            subtotalCents: 10000,
            discountCents: 0,
            totalCents: 10000,
            currency: 'KES',
          },
        }),
    },
  ];

  for (const step of steps) {
    await step.run();
    console.log(`✓ ${step.label}`);
  }

  console.log('\nEmail/PDF CI smoke passed (Resend not called).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
