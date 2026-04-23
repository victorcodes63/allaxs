import { HomeView } from "@/components/home/HomeView";
import {
  buildQuickFilterLinks,
  deriveHomeEventsLists,
  HOME_GENRE_LINKS,
} from "@/lib/home/derived-events";
import { fetchPublicEvents } from "@/lib/utils/api-server";

export const revalidate = 60;

export default async function Home() {
  let events: Awaited<ReturnType<typeof fetchPublicEvents>>["events"] = [];
  try {
    const data = await fetchPublicEvents({ page: 1, size: 48 });
    events = data.events;
  } catch {
    events = [];
  }

  const { featuredEvents, startingSoonEvents } = deriveHomeEventsLists(events);
  const quickFilterLinks = buildQuickFilterLinks();

  return (
    <HomeView
      featuredEvents={featuredEvents}
      startingSoonEvents={startingSoonEvents}
      quickFilterLinks={quickFilterLinks}
      genreLinks={HOME_GENRE_LINKS}
    />
  );
}
