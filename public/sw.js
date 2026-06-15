// Minimal service worker — its only job is to make the app installable
// (browsers require a registered SW with a fetch handler for the install
// prompt). It deliberately does NOT cache: this is a private, auth-scoped app,
// so requests fall through to the network normally to avoid serving stale or
// another user's responses.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No respondWith() — let the browser handle the request as usual. The
  // handler's presence is what satisfies installability.
});
