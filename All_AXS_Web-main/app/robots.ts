import { MetadataRoute } from "next";

const SITE_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/organizer/", "/dashboard/"],
    },
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}

