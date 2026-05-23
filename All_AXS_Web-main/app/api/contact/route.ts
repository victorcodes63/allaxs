import { NextRequest, NextResponse } from "next/server";
import { contactFormSchema } from "@/lib/marketing/contact";

const SUCCESS_MESSAGE = "Thanks — your message reached our team.";
const FALLBACK_FROM = "All AXS Website <hello@allaxs.com>";
const FALLBACK_TO = "hello@allaxs.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): string {
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br />");
  return [
    `<h2>New contact form submission</h2>`,
    `<p><strong>Topic:</strong> ${escapeHtml(input.subject)}</p>`,
    `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    `<hr />`,
    `<p>${safeMessage}</p>`,
  ].join("");
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = contactFormSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ??
      "Please double-check the form and try again.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const { name, email, subject, message } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY?.trim();

  /**
   * Graceful degradation: when Resend is not configured (local dev, preview),
   * log the submission server-side and still return 200 so the form feels
   * responsive. No PII is persisted beyond the log line.
   */
  if (!apiKey) {
    console.info("[contact] submission received (no RESEND_API_KEY set)", {
      name,
      email,
      subject,
      messagePreview: message.slice(0, 200),
    });
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
  }

  const from = process.env.CONTACT_FROM_EMAIL?.trim() || FALLBACK_FROM;
  const to = process.env.CONTACT_TO_EMAIL?.trim() || FALLBACK_TO;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: `[All AXS contact] ${subject} — ${name}`,
        html: buildEmailHtml({ name, email, subject, message }),
      }),
    });

    if (response.ok) {
      return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
    }

    const upstreamBody = await response.text().catch(() => "");
    console.error(
      "[contact] Resend emails API error",
      response.status,
      upstreamBody,
    );
    return NextResponse.json(
      {
        ok: false,
        message:
          "We couldn't deliver that just now. Please email hello@allaxs.com directly.",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[contact] unexpected error", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "We couldn't deliver that just now. Please email hello@allaxs.com directly.",
      },
      { status: 500 },
    );
  }
}
