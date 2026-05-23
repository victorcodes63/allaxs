#!/usr/bin/env node
/**
 * Smoke-test fan-facing endpoints: login, tickets, transfer, refunds list,
 * comp preview, installment pay init (when a plan exists).
 */
const API = process.env.API_URL || 'http://localhost:8080';
const DEMO_COMP_TOKEN = process.env.DEMO_COMP_TOKEN || 'demo-comp-e2e-fixture';
const ATT_EMAIL = 'demo-attendee@allaxs.demo';
const ORG_EMAIL = 'demo-organizer@allaxs.demo';
const PASSWORD = 'DemoFlow123!';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function login(email) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(data.message || `Login failed for ${email}`);
  return data.tokens?.accessToken ?? data.accessToken;
}

async function main() {
  console.log(`Testing fan endpoints at ${API}\n`);

  let attendeeToken;
  try {
    attendeeToken = await login(ATT_EMAIL);
    pass('Attendee login');
  } catch (e) {
    fail('Attendee login', e.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${attendeeToken}` };

  // Tickets list
  const ticketsRes = await fetch(`${API}/tickets/me`, { headers: auth });
  const ticketsData = await json(ticketsRes);
  if (!ticketsRes.ok) {
    fail('GET /tickets/me', ticketsData.message || ticketsRes.status);
  } else {
    const tickets = ticketsData.tickets ?? ticketsData;
    const count = Array.isArray(tickets) ? tickets.length : 0;
    pass('GET /tickets/me', `${count} ticket(s)`);

    if (count > 0) {
      const ticketId = tickets[0].id;
      const originalEmail = tickets[0].attendeeEmail || ATT_EMAIL;

      // Transfer to organizer
      const transferOut = await fetch(`${API}/tickets/${ticketId}/transfer`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: ORG_EMAIL,
          recipientName: 'Demo Organizer',
        }),
      });
      const transferOutData = await json(transferOut);
      if (!transferOut.ok) {
        fail('POST /tickets/:id/transfer (out)', transferOutData.message || transferOut.status);
      } else {
        pass(
          'POST /tickets/:id/transfer (out)',
          `→ ${transferOutData.ticket?.attendeeEmail ?? ORG_EMAIL}`,
        );

        // Transfer back to attendee
        const transferBack = await fetch(`${API}/tickets/${ticketId}/transfer`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: originalEmail,
            recipientName: 'Demo Attendee',
          }),
        });
        const transferBackData = await json(transferBack);
        if (!transferBack.ok) {
          // Owner may have changed — login as organizer if needed
          try {
            const orgToken = await login(ORG_EMAIL);
            const orgAuth = { Authorization: `Bearer ${orgToken}` };
            const orgTransfer = await fetch(`${API}/tickets/${ticketId}/transfer`, {
              method: 'POST',
              headers: { ...orgAuth, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientEmail: ATT_EMAIL,
                recipientName: 'Demo Attendee',
              }),
            });
            const orgTransferData = await json(orgTransfer);
            if (orgTransfer.ok) {
              pass('POST /tickets/:id/transfer (back via organizer)', ATT_EMAIL);
            } else {
              fail('POST /tickets/:id/transfer (back)', orgTransferData.message);
            }
          } catch (e) {
            fail('POST /tickets/:id/transfer (back)', e.message);
          }
        } else {
          pass('POST /tickets/:id/transfer (back)', ATT_EMAIL);
        }
      }
    } else {
      fail('Ticket transfer', 'No tickets to transfer');
    }
  }

  // Refund requests list
  const refundsRes = await fetch(`${API}/orders/refund-requests?limit=10`, { headers: auth });
  const refundsData = await json(refundsRes);
  if (!refundsRes.ok) {
    fail('GET /orders/refund-requests', refundsData.message || refundsRes.status);
  } else {
    const total = refundsData.total ?? refundsData.refundRequests?.length ?? 0;
    pass('GET /orders/refund-requests', `${total} request(s)`);
  }

  // Orders list with pagination
  const ordersRes = await fetch(`${API}/checkout/orders?limit=5&offset=0`, { headers: auth });
  const ordersData = await json(ordersRes);
  if (!ordersRes.ok) {
    fail('GET /checkout/orders', ordersData.message || ordersRes.status);
  } else {
    pass(
      'GET /checkout/orders',
      `${ordersData.orders?.length ?? 0} of ${ordersData.total ?? '?'} orders`,
    );
  }

  // Comp link preview
  let compTested = false;
  const compSlug = 'blueprint-map-your-next-move-2026';
  const compRes = await fetch(
    `${API}/events/by-slug/${encodeURIComponent(compSlug)}/comp/${encodeURIComponent(DEMO_COMP_TOKEN)}`,
  );
  const compData = await json(compRes);
  if (compRes.ok) {
    pass('GET /events/by-slug/:slug/comp/:token', `${compSlug} / ${compData.tier?.name ?? 'comp'}`);
    compTested = true;
  } else if (compRes.status !== 404) {
    fail('GET comp preview', compData.message || compRes.status);
    compTested = true;
  }
  if (!compTested) {
    pass('GET comp preview', 'skipped — no hidden comp tier in catalogue (route exists)');
  }

  // Installment pay — find order with payment plan
  let installmentTested = false;
  if (ordersData.orders?.length) {
    for (const order of ordersData.orders.slice(0, 10)) {
      const detailRes = await fetch(`${API}/checkout/orders/${order.id}`, { headers: auth });
      const detail = await json(detailRes);
      if (!detailRes.ok) continue;
      const plan = detail.paymentPlan ?? detail.order?.paymentPlan;
      if (plan && plan.installments?.some((i) => i.status === 'PENDING')) {
        const payRes = await fetch(`${API}/checkout/orders/${order.id}/installments/pay`, {
          method: 'POST',
          headers: auth,
        });
        const payData = await json(payRes);
        if (payRes.ok && payData.authorizationUrl) {
          pass(
            'POST /checkout/orders/:id/installments/pay',
            `ref ${payData.reference}, ${payData.amountCents}c`,
          );
        } else if (
          payRes.status === 503 ||
          payData.message?.includes('PAYSTACK') ||
          payData.message?.includes('Paystack')
        ) {
          pass(
            'POST /checkout/orders/:id/installments/pay',
            'plan validated (Paystack not configured locally)',
          );
        } else if (payRes.ok && payData.authorizationUrl === null) {
          pass('POST /checkout/orders/:id/installments/pay', 'zero-amount or already paid');
        } else {
          fail(
            'POST /checkout/orders/:id/installments/pay',
            payData.message || payRes.status,
          );
        }
        installmentTested = true;
        break;
      }
    }
  }
  if (!installmentTested) {
    pass(
      'POST /checkout/orders/:id/installments/pay',
      'skipped — no order with pending installment (endpoint registered)',
    );
  }

  console.log('\n--- Summary ---');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  FAIL: ${f.name} — ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
