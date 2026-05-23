import type { Metadata } from "next";
import { OrganizersMarketingPage } from "@/components/organizers/OrganizersMarketingPage";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";

export const metadata: Metadata = {
  title: "For organizers | All AXS",
  description:
    "Set up your organizer profile, publish events, configure ticket tiers and media, submit for review, and sell tickets with QR-ready passes on All AXS.",
};

export default async function OrganizersPage() {
  await redirectSignedInFromGuestPublicPath("/organizers");
  return <OrganizersMarketingPage />;
}
