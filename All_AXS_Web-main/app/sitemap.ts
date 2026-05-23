import { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/seo/site-url";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

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

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_BASE_URL}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_BASE_URL}/events`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_BASE_URL}/organizers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${SITE_BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_BASE_URL}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_BASE_URL}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_BASE_URL}/payout-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
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

