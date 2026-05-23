/**
 * Host-facing FAQ content for the organizer support center.
 * Mirrors the fan-side `help-faq.ts` structure so the same pattern is reused.
 */
export interface HostFaqItem {
  q: string;
  a: string;
}

export interface HostFaqSection {
  id: string;
  title: string;
  items: HostFaqItem[];
}

export const HOST_FAQ_SECTIONS: HostFaqSection[] = [
  {
    id: "publishing",
    title: "Publishing & approvals",
    items: [
      {
        q: "How do I publish an event?",
        a: "Open the event editor, finish the Details, Media, and Ticket Tiers tabs, then click Submit for Review. Once an admin approves it, return to Details and click Publish to take it live on discovery.",
      },
      {
        q: "Why was my event rejected?",
        a: "Rejection notes are sent to the email on your organizer profile. Open the rejected event in your editor, address the feedback, and click Resubmit for Review.",
      },
      {
        q: "Can I unpublish a live event?",
        a: "Yes. From the editor's Details tab, use the Unpublish button. Existing buyers keep their tickets — the listing simply disappears from public discovery.",
      },
    ],
  },
  {
    id: "payouts",
    title: "Payouts & withdrawals",
    items: [
      {
        q: "When can I withdraw my earnings?",
        a: "Funds become available after the event clears the platform settlement window described in the payout policy. The Earnings page shows your available, pending, and reserved balances.",
      },
      {
        q: "How do I request a withdrawal?",
        a: "On the Earnings page, use the Request a withdrawal panel: pick an amount above the minimum, submit, and an admin will review and disburse to your registered payout method.",
      },
      {
        q: "How long do withdrawals take to arrive?",
        a: "Most mobile money payouts arrive within 1–3 business days after approval. Bank transfers can take 5–7 business days depending on your bank.",
      },
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    items: [
      {
        q: "How do I approve a refund request?",
        a: "Open the Refunds page, find the request, and click Approve. Add an optional note that we'll include in the buyer email. The amount is deducted from your earnings ledger.",
      },
      {
        q: "Can I refund someone proactively?",
        a: "Yes. Use Initiate refund on the Refunds page, paste the order ID, choose an amount (or leave blank for a full refund), and submit a reason for the buyer.",
      },
      {
        q: "Can buyers cancel approved refunds?",
        a: "Once you approve a refund the request is locked and proceeds to disbursement. Contact support if a payout needs to be reversed.",
      },
    ],
  },
  {
    id: "scanning",
    title: "Door scan setup",
    items: [
      {
        q: "How do I set up volunteers to scan tickets?",
        a: "Open Door scan from the sidebar and switch to the Volunteer links tab. Create a session with an expiry, then send the link by email or share the QR code with your volunteer.",
      },
      {
        q: "Do volunteers need an account?",
        a: "No. The scanner link is a session token — they tap it on a phone or tablet to open the scanner without signing in.",
      },
      {
        q: "Can I revoke access mid-event?",
        a: "Yes. Use the Revoke action on the Door scan page to invalidate a session immediately if a device is lost.",
      },
    ],
  },
];
