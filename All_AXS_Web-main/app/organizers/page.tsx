import type { Metadata } from "next";
import { OrganizersMarketingPage } from "@/components/organizers/OrganizersMarketingPage";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";
import { redirectSearchFromPageParams } from "@/lib/auth/guest-only-public-routes";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "For organizers | All AXS",
  description:
    "Set up your organizer profile, publish events, configure ticket tiers and media, submit for review, and sell tickets with QR-ready passes on All AXS.",
  path: "/organizers",
});

type OrganizersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrganizersPage({ searchParams }: OrganizersPageProps) {
  const params = await searchParams;
  await redirectSignedInFromGuestPublicPath(
    "/organizers",
    redirectSearchFromPageParams(params),
  );
  return <OrganizersMarketingPage />;
}
