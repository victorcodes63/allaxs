import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubLegalSlugView } from "@/components/legal/HubLegalSlugView";
import { HUB_LEGAL_SLUGS } from "@/lib/legal/hub-paths";
import { LEGAL_DOCUMENTS } from "@/lib/legal/policies";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HUB_LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = LEGAL_DOCUMENTS[slug];
  if (!document) return { title: "Legal | All AXS" };

  return {
    title: `${document.title} | All AXS`,
    description: document.description,
  };
}

export default async function OrganizerLegalPage({ params }: PageProps) {
  const { slug } = await params;
  if (!LEGAL_DOCUMENTS[slug]) notFound();

  return <HubLegalSlugView prefix="/organizer" slug={slug} />;
}
