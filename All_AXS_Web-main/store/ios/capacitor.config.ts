import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Loads the live PWA. For local dev, point server.url at your machine
 * (e.g. http://YOUR_LAN_IP:3000) and set cleartext: true.
 */
const config: CapacitorConfig = {
  appId: "com.allaxs.app",
  appName: "All AXS",
  webDir: "www",
  server: {
    url: "https://www.axs.africa",
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: true,
  },
};

export default config;
