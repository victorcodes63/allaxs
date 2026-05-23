import type { Metadata } from "next";
import { SITE_BASE_URL } from "./site-url";

export const DEFAULT_OG_IMAGE = "/images/gem_hero.png";
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const SITE_NAME = "All AXS";

export interface BuildPageMetadataInput {
  /** Final `<title>` value. Pass the fully composed string (e.g. "Pricing | All AXS"). */
  title: string;
  /** Meta description, ~155–160 chars max. */
  description: string;
  /**
   * Site-relative path of the page, including the leading slash (e.g. "/pricing").
   * Used to build canonical and OG URLs.
   */
  path: string;
  /**
   * Optional OG/Twitter image override. May be a site-relative path or an
   * absolute URL. Defaults to {@link DEFAULT_OG_IMAGE}.
   */
  image?: string;
  /** Optional alt text for the OG/Twitter image. Defaults to the page title. */
  imageAlt?: string;
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_BASE_URL}${normalized}`;
}

/**
 * Build a Next.js {@link Metadata} object with consistent OpenGraph and
 * Twitter card defaults for marketing/static pages. Page-level metadata
 * objects can spread additional fields on top of the returned value.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  imageAlt,
}: BuildPageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);
  const alt = imageAlt ?? title;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
