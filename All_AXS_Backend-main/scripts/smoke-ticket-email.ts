/**
 * Send one ticket confirmation email (QR inline + PDF attachment).
 *
 *   cd All_AXS_Backend-main
 *   SMOKE_EMAIL_TO=vichumo38@gmail.com npm run smoke:ticket-email
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../src/auth/services/email.service';
import { TicketPdfService } from '../src/tickets/ticket-pdf.service';
import { EventType } from '../src/domain/enums';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const to = (process.env.SMOKE_EMAIL_TO || process.argv[2])?.trim();
  if (!to) {
    console.error('Usage: SMOKE_EMAIL_TO=you@gmail.com npm run smoke:ticket-email');
    process.exit(1);
  }

  const config = new ConfigService();
  const emailService = new EmailService(config, new TicketPdfService(config));

  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

  console.log(`Sending ticket email to ${to}…`);
  await emailService.sendTicketEmail({
    buyerName: 'Victor',
    buyerEmail: to,
    eventTitle: 'Smoke Test Concert',
    event: {
      title: 'Smoke Test Concert',
      slug: 'smoke-test-concert',
      startAt: start,
      endAt: end,
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
  });
  console.log('Done — check inbox for the PDF attachment (QR is inside the PDF).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
