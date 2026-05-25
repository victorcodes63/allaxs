import type { MetadataRoute } from "next";

/**
 * Web app manifest — enables Add to Home Screen / Install app on Android, iOS, and desktop.
 * Served at `/manifest.webmanifest` by Next.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "All AXS — Events & ticketing",
    short_name: "All AXS",
    description:
      "Discover live experiences and get tickets in seconds—built for fans and organizers across Africa.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "portrait",
    background_color: "#0c0c0f",
    theme_color: "#0c0c0f",
    categories: ["entertainment", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/favicons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
