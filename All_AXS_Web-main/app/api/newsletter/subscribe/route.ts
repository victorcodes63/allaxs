import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Please enter a valid email address"),
});

const SUCCESS_MESSAGE = "Thanks — you're on the list.";

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

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please enter a valid email address.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const email = parsed.data.email;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const audienceId = process.env.RESEND_AUDIENCE_ID?.trim();

  /** Graceful stub for dev/preview — log only, no PII persisted, until Resend is wired. */
  if (!apiKey || !audienceId) {
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
  }

  try {
    const response = await fetch(
      `https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      },
    );

    /** 409 from Resend means the contact already exists — treat as success for the user. */
    if (response.ok || response.status === 409) {
      return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
    }

    /** Surface a friendly message; log raw upstream body server-side for triage. */
    const upstreamBody = await response.text().catch(() => "");
    console.error(
      "[newsletter/subscribe] Resend audiences API error",
      response.status,
      upstreamBody,
    );
    return NextResponse.json(
      {
        ok: false,
        message:
          "We couldn't subscribe that address right now. Please try again in a minute.",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("[newsletter/subscribe] unexpected error", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          "We couldn't subscribe that address right now. Please try again in a minute.",
      },
      { status: 500 },
    );
  }
}
