import { redirect, permanentRedirect } from "next/navigation";
import { getEventSlugById } from "@/lib/utils/api-server";

interface EventRedirectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventRedirectPage({
  params,
}: EventRedirectPageProps) {
  const { id } = await params;

  try {
    const slug = await getEventSlugById(id);
    permanentRedirect(`/e/${slug}`); // Permanent redirect (301)
  } catch {
    // If event not found, redirect to events list
    redirect("/events"); // Temporary redirect (302)
  }
}

