import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal/links";

type FooterLegalLinksProps = {
  className?: string;
  linkClassName?: string;
};

export function FooterLegalLinks({
  className = "flex flex-wrap gap-x-6 gap-y-2",
  linkClassName = "text-white/75 transition-colors hover:text-primary/85",
}: FooterLegalLinksProps) {
  return (
    <nav className={className} aria-label="Legal policies">
      {LEGAL_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClassName}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
