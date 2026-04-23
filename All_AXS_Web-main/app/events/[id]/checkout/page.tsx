import { notFound } from "next/navigation";
import { fetchEventBySlug, getEventSlugById } from "@/lib/utils/api-server";
import { CheckoutExperience } from "@/components/checkout/CheckoutExperience";

interface Props {
  params: Promise<{ id: string }>;
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
