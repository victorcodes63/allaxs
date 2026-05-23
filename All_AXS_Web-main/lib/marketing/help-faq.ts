/**
 * Shared FAQ content for public `/help` and the signed-in `/dashboard/support`
 * surfaces. Keep the language buyer-friendly — no "delegate" jargon here.
 */
export interface HelpFaqItem {
  q: string;
  a: string;
}

export interface HelpFaqSection {
  id: string;
  title: string;
  items: HelpFaqItem[];
}

export const HELP_FAQ_SECTIONS: HelpFaqSection[] = [
  {
    id: "refunds",
    title: "Refunds & cancellations",
    items: [
      {
        q: "How do I request a refund?",
        a: "Sign in, open the order from My orders, scroll to Request a refund, and submit your reason. An admin reviews every request — approval is not automatic.",
      },
      {
        q: "How long do refunds take?",
        a: "Approved refunds typically arrive within 7–14 business days for mobile money and 7–21 days for card payments, depending on your provider.",
      },
      {
        q: "Where can I track refund status?",
        a: "Check My refunds in your fan dashboard for every request linked to your account, or open the original order for full details.",
      },
    ],
  },
  {
    id: "tickets",
    title: "Tickets & entry",
    items: [
      {
        q: "Where are my passes after checkout?",
        a: "Digital passes appear in My tickets immediately after payment. We also email a PDF backup to your receipt address.",
      },
      {
        q: "Can I transfer a ticket to someone else?",
        a: "Open the pass in My tickets and use Transfer ticket to send it to another email. The recipient gets the QR pass under their account if they sign up with that address.",
      },
      {
        q: "What should I bring to the venue?",
        a: "Show the QR code from your pass in the All AXS wallet or the PDF we emailed. Arrive early for smooth check-in.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & sign-in",
    items: [
      {
        q: "I bought tickets as a guest — how do I sign in?",
        a: "Use the same email from checkout. If you did not set a password, choose Forgot password on the sign-in page to create one.",
      },
      {
        q: "How do I update my name or phone?",
        a: "Go to Account in your fan dashboard and save your profile. Your email is your username and cannot be changed here.",
      },
      {
        q: "How do I close my account?",
        a: "Open Account, scroll to Close account, and follow the confirmation steps. Tickets already issued remain valid for entry.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & receipts",
    items: [
      {
        q: "Which payment methods are supported?",
        a: "We support card and mobile money through Paystack where enabled for the event. Available options appear at checkout.",
      },
      {
        q: "Where is my receipt?",
        a: "Every completed order is listed under My orders with payment reference, amount, and a link to resend your receipt email.",
      },
      {
        q: "My payment succeeded but I have no tickets",
        a: "Refresh My tickets and check your spam folder. If passes still do not appear within a few minutes, contact support with your payment reference.",
      },
    ],
  },
];
