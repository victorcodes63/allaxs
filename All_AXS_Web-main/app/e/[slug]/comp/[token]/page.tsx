import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCompLink } from "@/lib/utils/api-server";
import { CompCheckoutExperience } from "@/components/checkout/CompCheckoutExperience";
import { redirectSignedInFromGuestPublicPath } from "@/lib/auth/redirect-signed-in-from-public";

interface Props {
  params: Promise<{ slug: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, token } = await params;
  try {
    const preview = await fetchCompLink(slug, token);
    return {
      title: `Complimentary · ${preview.event.title} | All AXS`,
      description: `Claim your complimentary ${preview.tier.name} pass for ${preview.event.title}.`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: "Comp link | All AXS",
      robots: { index: false, follow: false },
    };
  }
}

export default async function CompLinkCheckoutPage({ params }: Props) {
  const { slug, token } = await params;
  await redirectSignedInFromGuestPublicPath(`/e/${slug}/comp/${token}`);

  let preview;
  try {
    preview = await fetchCompLink(slug, token);
  } catch {
    notFound();
  }

  return <CompCheckoutExperience preview={preview} compToken={token} />;
}
