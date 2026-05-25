# All AXS — Play Store & App Store wrappers

The production web app is a **Progressive Web App (PWA)**. These folders hold **thin native shells** that load `https://www.axs.africa` (or your staging URL) so you can publish to Google Play and the Apple App Store without rewriting the product.

## Prerequisites

1. PWA live on HTTPS with a valid manifest and service worker (`/sw.js`).
2. **Web Push** VAPID keys on the API (see backend `npm run push:vapid`).
3. Production domain chosen (examples below use `www.axs.africa`).

## Android — Trusted Web Activity (TWA)

Google Play can ship your site inside a Chrome-based wrapper with no duplicate UI.

### Steps

1. Install [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap): `npm i -g @bubblewrap/cli`
2. Copy `store/android/twa-manifest.json` and set `webManifestUrl`, `rootUrl`, and `packageId`.
3. Generate the project: `bubblewrap init --manifest=https://www.axs.africa/manifest.webmanifest` (Next.js serves this from `app/manifest.ts`)
4. Replace signing keys and build: `bubblewrap build`
5. Publish the AAB to Play Console (internal testing first).

### Digital Asset Links

Host `/.well-known/assetlinks.json` on the **same origin** as the PWA (see `public/.well-known/assetlinks.json`).

- Set `package_name` to your Android application id (e.g. `com.allaxs.app`).
- Set `sha256_cert_fingerprints` to your **release** signing cert (from Play Console or `keytool -list -v -keystore ...`).

Verify: [Google Statement List Tester](https://developers.google.com/digital-asset-links/tools/generator)

## iOS — Capacitor shell

Apple requires a native binary; Capacitor wraps your PWA URL in a WKWebView.

### Steps

1. `cd store/ios && npm install`
2. Set `server.url` in `capacitor.config.ts` to production (or staging for TestFlight).
3. `npx cap add ios && npx cap sync ios`
4. Open `ios/App/App.xcworkspace` in Xcode, set bundle id `com.allaxs.app`, icons, and signing.
5. Enable **Push Notifications** capability if you add APNs later (web push works in installed PWA on iOS 16.4+ without APNs).
6. Archive and upload to App Store Connect.

For a no-code alternative, [PWABuilder](https://www.pwabuilder.com/) can generate iOS/Android packages from your live URL.

## Environment checklist

| Surface | Variable / file |
|--------|------------------|
| API | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT` |
| Web | `NEXT_PUBLIC_SITE_URL` matches store wrapper origin |
| Android | `public/.well-known/assetlinks.json` |
| iOS | `store/ios/capacitor.config.ts` → `server.url` |

## Support matrix

| Feature | Browser PWA | Android TWA | iOS Capacitor |
|--------|---------------|-------------|---------------|
| Install / home screen | Yes | Play install | App Store |
| Offline tickets (SW + localStorage) | Yes | Yes | Yes |
| Web Push | Chrome / Firefox / Edge | Yes (Chromium) | iOS 16.4+ when added to Home Screen; native APNs optional later |
