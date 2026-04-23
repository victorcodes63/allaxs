import { MetadataRoute } from "next";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const SITE_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch published events for sitemap
  let events: Array<{
    slug: string;
    updatedAt: string;
  }> = [];

  try {
    const response = await fetch(`${API_BASE_URL}/events/public?size=1000`, {
      next: { revalidate: 3600 }, // Revalidate every hour
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      events = data.events.map((event: { slug: string; updatedAt: string }) => ({
        slug: event.slug,
        updatedAt: event.updatedAt,
      }));
    }
  } catch (error) {
    console.error("Error fetching events for sitemap:", error);
    // Continue with empty events array
  }

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_BASE_URL}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_BASE_URL}/events`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_BASE_URL}/organizers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
  ];

  // Event detail pages
  const eventRoutes: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${SITE_BASE_URL}/e/${event.slug}`,
    lastModified: new Date(event.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...eventRoutes];
}

