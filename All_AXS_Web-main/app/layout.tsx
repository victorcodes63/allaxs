import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { AppChrome } from "@/components/layout/AppChrome";
import { AuthProvider } from "@/lib/auth-context";
import { AnalyticsLoader } from "@/components/consent/AnalyticsLoader";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_BASE_URL } from "@/lib/seo/site-url";
import "./globals.css";

/** Site-wide: Figtree (300–700), same weight range as before. */
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ROOT_TITLE = "All AXS | Events & ticketing";
const ROOT_DESCRIPTION =
  "Discover live experiences and get tickets in seconds—built for fans and organizers across Africa.";

const rootPageMetadata = buildPageMetadata({
  title: ROOT_TITLE,
  description: ROOT_DESCRIPTION,
  path: "/",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE_URL),
  title: {
    default: ROOT_TITLE,
    template: "%s | All AXS",
  },
  description: ROOT_DESCRIPTION,
  applicationName: "All AXS",
  appleWebApp: {
    capable: true,
    title: "All AXS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicons/favicon-32x32.png"],
  },
  openGraph: rootPageMetadata.openGraph,
  twitter: rootPageMetadata.twitter,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c0c0f",
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
        <PwaRegistration />
        <CookieConsentBanner />
        <PwaInstallBanner />
        <AnalyticsLoader />
      </body>
    </html>
  );
}
