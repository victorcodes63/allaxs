import { NextResponse } from "next/server";
import { fetchEventBySlug } from "@/lib/utils/api-server";

/**
 * Public catalog event by slug (no auth). Used by wallet / ticket views to hydrate event details
 * when the ticket API does not embed full event objects.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const decoded = decodeURIComponent(slug);
  try {
    const event = await fetchEventBySlug(decoded);
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ message: "Event not found" }, { status: 404 });
  }
}
