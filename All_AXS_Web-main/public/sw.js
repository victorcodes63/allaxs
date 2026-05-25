/**
 * All AXS service worker: offline fallback, API stale-while-revalidate, web push.
 */
const OFFLINE_CACHE = "allaxs-offline-v1";
const API_CACHE = "allaxs-api-v1";

const OFFLINE_URL = "/offline.html";

/** Same-origin API routes we cache for offline ticket/notification access. */
const API_CACHE_PATTERNS = [
  /^\/api\/tickets\/me$/,
  /^\/api\/tickets\/[^/]+$/,
  /^\/api\/notifications(\?|$)/,
];

function isApiCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return API_CACHE_PATTERNS.some((re) => re.test(url.pathname + url.search));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const network = await networkPromise;
  if (network) return network;
  return Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== OFFLINE_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (isApiCacheable(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match(OFFLINE_URL);
      }
      return Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "All AXS",
    body: "You have a new notification.",
    url: "/notifications",
    tag: "allaxs-notification",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    const text = event.data?.text();
    if (text) payload.body = text;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: "/favicons/android-chrome-192x192.png",
      badge: "/favicons/favicon-32x32.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || "/notifications";

  const absolute = new URL(target, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client && typeof client.navigate === "function") {
                return client.navigate(absolute);
              }
              return undefined;
            });
          }
        }
        return self.clients.openWindow(absolute);
      }),
  );
});
