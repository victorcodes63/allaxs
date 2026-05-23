import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchEventBySlug, getEventSlugById } from "@/lib/utils/api-server";
import { CheckoutExperience } from "@/components/checkout/CheckoutExperience";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";
import { cookies } from "next/headers";
import {
  accessTokenIsExpired,
  decodeAccessTokenPayload,
} from "@/lib/auth/jwt-payload";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ waitlist?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const slug = await getEventSlugById(id);
    const event = await fetchEventBySlug(slug);
    return {
      title: `Checkout · ${event.title} | All AXS`,
      description: `Complete your ticket purchase for ${event.title}.`,
    };
  } catch {
    return { title: "Checkout | All AXS" };
  }
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { waitlist: waitlistToken } = await searchParams;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const decoded = accessToken ? decodeAccessTokenPayload(accessToken) : null;
  if (decoded?.email && !accessTokenIsExpired(decoded)) {
    try {
      const slug = await getEventSlugById(id);
      const qs = waitlistToken
        ? `?waitlist=${encodeURIComponent(waitlistToken)}`
        : "";
      redirect(`/dashboard/events/${slug}/checkout${qs}`);
    } catch {
      await redirectSignedInFromGuestPublicPath("/events");
    }
  }

  let event;
  try {
    const slug = await getEventSlugById(id);
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  return <CheckoutExperience event={event} waitlistToken={waitlistToken} />;
}
