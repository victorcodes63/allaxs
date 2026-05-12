/**
 * Send one test email via Resend using the same env vars as the API.
 * Proves RESEND_API_KEY + RESEND_FROM work; Resend dashboard "Last used" should update.
 *
 *   cd All_AXS_Backend-main
 *   SMOKE_EMAIL_TO=you@gmail.com npm run smoke:resend
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Resend } from 'resend';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const to = (process.env.SMOKE_EMAIL_TO || process.argv[2])?.trim();

  if (!key || !from || !to) {
    console.error(
      'Missing input. Need RESEND_API_KEY and RESEND_FROM in .env, plus recipient:\n' +
        '  SMOKE_EMAIL_TO=you@gmail.com npm run smoke:resend',
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        keyPrefix: `${key.slice(0, 8)}…`,
        from,
        to,
      },
      null,
      2,
    ),
  );

  const resend = new Resend(key);
  const result = await resend.emails.send({
    from,
    to,
    subject: 'All AXS — Resend smoke test',
    html: '<p>If you received this, Resend credentials in <code>.env</code> are valid.</p>',
  });

  console.log('Resend response:', JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
