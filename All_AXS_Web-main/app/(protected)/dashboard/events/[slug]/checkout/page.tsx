import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchEventBySlug } from "@/lib/utils/api-server";
import { CheckoutExperience } from "@/components/checkout/CheckoutExperience";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await fetchEventBySlug(slug);
    return {
      title: `Checkout · ${event.title} | All AXS`,
      description: `Complete your ticket purchase for ${event.title}.`,
    };
  } catch {
    return { title: "Checkout | All AXS" };
  }
}

export default async function DashboardCheckoutPage({ params }: Props) {
  const { slug } = await params;
  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    notFound();
  }

  return <CheckoutExperience event={event} context="dashboard" />;
}
