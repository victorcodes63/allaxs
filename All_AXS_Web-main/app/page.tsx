import type { Metadata } from "next";
import {
  buildQuickFilterLinks,
  deriveHomeEventsLists,
  HOME_GENRE_LINKS,
} from "@/lib/home/derived-events";
import { isDemoPublicEventsMode } from "@/lib/public-events-mode";
import { fetchPublicEvents } from "@/lib/utils/api-server";
import { HomeView } from "@/components/home/HomeView";
import { HomeJsonLd } from "@/components/seo/HomeJsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";
import { redirectSearchFromPageParams } from "@/lib/auth/guest-only-public-routes";

export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: "All AXS | Events & ticketing",
  description:
    "Discover live experiences and get tickets in seconds—built for fans and organizers across Africa.",
  path: "/",
});

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  await redirectSignedInFromGuestPublicPath("/", redirectSearchFromPageParams(params));
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
    <>
      <HomeJsonLd />
      <HomeView
        featuredEvents={featuredEvents}
        startingSoonEvents={startingSoonEvents}
        quickFilterLinks={quickFilterLinks}
        genreLinks={HOME_GENRE_LINKS}
      />
    </>
  );
}
