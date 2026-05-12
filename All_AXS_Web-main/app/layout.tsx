import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
import { AuthProvider } from "@/lib/auth-context";
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
  manifest: "/favicons/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicons/favicon-32x32.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} axs-marketing-dark`}>
      <body
        className={`font-sans antialiased min-h-dvh flex flex-col bg-background text-foreground`}
      >
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
