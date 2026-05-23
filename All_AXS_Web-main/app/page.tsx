import {
  buildQuickFilterLinks,
  deriveHomeEventsLists,
  HOME_GENRE_LINKS,
} from "@/lib/home/derived-events";
import { isDemoPublicEventsMode } from "@/lib/public-events-mode";
import { fetchPublicEvents } from "@/lib/utils/api-server";
import { HomeView } from "@/components/home/HomeView";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";

export const revalidate = 60;

export default async function Home() {
  await redirectSignedInFromGuestPublicPath("/");
  let featuredEvents: Awaited<
    ReturnType<typeof deriveHomeEventsLists>
  >["featuredEvents"] = [];
  let startingSoonEvents: Awaited<
    ReturnType<typeof deriveHomeEventsLists>
  >["startingSoonEvents"] = [];

  try {
    if (isDemoPublicEventsMode()) {
      const data = await fetchPublicEvents({ page: 1, size: 48 });
      const derived = deriveHomeEventsLists(data.events);
      featuredEvents = derived.featuredEvents;
      startingSoonEvents = derived.startingSoonEvents;
    } else {
      const [featuredData, catalogData] = await Promise.all([
        fetchPublicEvents({ featured: true, size: 12 }),
        fetchPublicEvents({ page: 1, size: 48 }),
      ]);
      const derived = deriveHomeEventsLists(catalogData.events, {
        featuredFromApi: featuredData.events,
      });
      featuredEvents = derived.featuredEvents;
      startingSoonEvents = derived.startingSoonEvents;
    }
  } catch {
    featuredEvents = [];
    startingSoonEvents = [];
  }

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
