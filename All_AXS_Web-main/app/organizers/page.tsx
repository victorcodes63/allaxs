import type { Metadata } from "next";
import { OrganizersMarketingPage } from "@/components/organizers/OrganizersMarketingPage";

export const metadata: Metadata = {
  title: "For organizers | All AXS",
  description:
    "Set up your organizer profile, publish events, configure ticket tiers and media, submit for review, and sell tickets with QR-ready passes on All AXS.",
};

export default function OrganizersPage() {
  return <OrganizersMarketingPage />;
}
