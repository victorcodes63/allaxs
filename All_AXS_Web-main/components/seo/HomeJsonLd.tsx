import { SITE_BASE_URL } from "@/lib/seo/site-url";
import { JsonLd } from "./JsonLd";

/**
 * Structured data for the home page: an Organization entry describing All AXS
 * plus a WebSite entry that exposes a SearchAction so Google can render a
 * sitelinks search box pointing at `/events?search=...`.
 */
export function HomeJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_BASE_URL}/#organization`,
    name: "All AXS",
    url: SITE_BASE_URL,
    logo: `${SITE_BASE_URL}/favicons/android-chrome-512x512.png`,
    description:
      "All AXS is an events and ticketing platform for fans and organizers across Africa.",
  } as const;

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_BASE_URL}/#website`,
    url: SITE_BASE_URL,
    name: "All AXS",
    publisher: { "@id": `${SITE_BASE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_BASE_URL}/events?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;

  return (
    <>
      <JsonLd id="ld-organization" data={organization} />
      <JsonLd id="ld-website" data={website} />
    </>
  );
}
