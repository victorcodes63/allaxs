import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./globals.css";

/** Site-wide: Figtree (300–700), same weight range as before. */
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "All AXS | Events & ticketing",
  description:
    "Discover live experiences and get tickets in seconds—built for fans and organizers across Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body
        className={`font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <SiteHeader />

        <main className="flex-1 axs-page-shell py-8 md:py-10">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}
