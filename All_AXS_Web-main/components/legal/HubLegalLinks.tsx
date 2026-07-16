"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildHubLegalLinks, hubLegalPrefixFromPathname } from "@/lib/legal/hub-paths";
import { platformSupportMailto } from "@/lib/site-contact";

type HubLegalLinksProps = {
  collapsed?: boolean;
  compact?: boolean;
};

/** Legal policy links shown in dashboard hub sidebars. */
export function HubLegalLinks({ collapsed, compact }: HubLegalLinksProps) {
  const pathname = usePathname() ?? "";
  const links = buildHubLegalLinks(hubLegalPrefixFromPathname(pathname));

  if (collapsed) return null;

  return (
    <div
      className={[
        "border-t border-border/50",
        compact ? "px-3 py-3" : "px-4 py-3",
      ].join(" ")}
    >
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        Help &amp; legal
      </p>
      <nav className="flex flex-col gap-1" aria-label="Help and legal">
        <a
          href={platformSupportMailto({ subject: "All AXS support" })}
          className="rounded-md px-2 py-1.5 text-xs text-foreground/60 transition-colors hover:bg-wash hover:text-foreground"
        >
          Contact support
        </a>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-2 py-1.5 text-xs text-foreground/60 transition-colors hover:bg-wash hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
