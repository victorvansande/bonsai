// Laat de app ook zonder verbinding openen.
// Netwerk eerst, zodat een nieuwe versie meteen binnenkomt; lukt dat niet, dan de laatste kopie.
const CACHE = "bonsai-almanak";
const SHELL = ["./", "index.html", "app.css", "app.js", "content.js", "manifest.webmanifest", "icon-180.png", "icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(async () => (await caches.match(event.request, { ignoreSearch: true })) ?? caches.match("index.html")),
  );
});
