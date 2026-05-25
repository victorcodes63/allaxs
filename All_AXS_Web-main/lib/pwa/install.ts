export const PWA_INSTALL_DISMISS_KEY = "allaxs_pwa_install_dismissed";

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari legacy
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isAppleDevice = /iphone|ipad|ipod/i.test(ua);
  const isSafari =
    /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
  return isAppleDevice && isSafari;
}

export function shouldOfferPwaInstall(pathname: string): boolean {
  if (isPwaStandalone()) return false;
  const authPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/check-email",
    "/resend-verification",
  ];
  return !authPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function readInstallDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissPwaInstall(): void {
  try {
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1");
  } catch {
    /* private mode */
  }
}
