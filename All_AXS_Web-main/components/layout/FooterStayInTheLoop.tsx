import Link from "next/link";

const CONTACT_EMAIL = "hello@allaxs.com";

/** Optional social URLs — set in Vercel when accounts exist; omitted links are not shown. */
const SOCIAL_LINKS = [
  {
    label: "X",
    href: process.env.NEXT_PUBLIC_SOCIAL_X_URL?.trim(),
  },
  {
    label: "LinkedIn",
    href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL?.trim(),
  },
  {
    label: "Instagram",
    href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim(),
  },
].filter((item): item is { label: string; href: string } => Boolean(item.href));

const STATIC_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: `mailto:${CONTACT_EMAIL}`, label: "Email", external: true },
  { href: "/events", label: "Events" },
  { href: "/organizers", label: "For organizers" },
];

const linkClassName =
  "text-sm font-medium text-foreground/70 underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-primary/90";

/**
 * Footer “Follow us” band — no mailing-list form until Resend Audiences is wired.
 */
export function FooterStayInTheLoop() {
  return (
    <div className="min-w-0 max-w-3xl text-left" aria-labelledby="footer-follow-label">
      <p id="footer-follow-label" className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/45">
        Follow us
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/60">
        Product updates and event drops — reach out or explore what&apos;s live. We don&apos;t collect
        newsletter signups on this page.
      </p>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Follow All AXS">
        {STATIC_LINKS.map(({ href, label, external }) =>
          external ? (
            <a key={href} href={href} className={linkClassName}>
              {label}
            </a>
          ) : (
            <Link key={href} href={href} className={linkClassName}>
              {label}
            </Link>
          ),
        )}
        {SOCIAL_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={linkClassName}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        ))}
      </nav>
      <p className="mt-3 text-[11px] leading-relaxed text-foreground/45">
        Account and purchase data are described in our{" "}
        <Link href="/privacy" className="font-medium text-foreground/55 underline hover:text-primary/85">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
