import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchEventBySlug, getEventSlugById } from "@/lib/utils/api-server";
import { CheckoutExperience } from "@/components/checkout/CheckoutExperience";

interface Props {
  params: Promise<{ id: string }>;
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

export default async function CheckoutPage({ params }: Props) {
  const { id } = await params;
  let event;
  try {
    const slug = await getEventSlugById(id);
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  return <CheckoutExperience event={event} />;
}
