import Link from "next/link";
import type { LegalDocument, LegalLink, PolicyBlock } from "@/lib/legal/types";
import { LEGAL_LINKS, LEGAL_OFFICE_ADDRESS } from "@/lib/legal/links";

function PolicyBlockView({ block }: { block: PolicyBlock }) {
  if (block.type === "paragraph") {
    return <p className="text-foreground/90 leading-relaxed">{block.text}</p>;
  }
  return (
    <ul className="list-disc space-y-2 pl-5 text-foreground/90 leading-relaxed">
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

type LegalDocumentPageProps = {
  document: LegalDocument;
  links?: LegalLink[];
  backHref?: string;
  backLabel?: string;
};

export function LegalDocumentPage({
  document,
  links = LEGAL_LINKS,
  backHref = "/",
  backLabel = "← Home",
}: LegalDocumentPageProps) {
  const otherLinks = links.filter((link) => !link.href.endsWith(`/${document.slug}`));

  return (
    <article className="mx-auto w-full max-w-3xl pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        {document.eyebrow}
      </p>
      <h1 className="font-display mt-2 text-4xl text-foreground">{document.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{document.description}</p>
      <p className="mt-3 text-sm text-muted/80">{LEGAL_OFFICE_ADDRESS}</p>

      <nav
        className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-y border-border py-4 text-sm"
        aria-label="Related policies"
      >
        {otherLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="font-medium text-primary hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-10 space-y-10">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 space-y-4">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.blocks.map((block, index) => (
                <PolicyBlockView key={`${section.id}-${index}`} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="not-prose mt-12 border-t border-border pt-8">
        <Link href={backHref} className="font-semibold text-primary hover:underline">
          {backLabel}
        </Link>
      </p>
    </article>
  );
}
