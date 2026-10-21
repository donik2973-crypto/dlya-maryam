/* Service worker: lets the site be installed like an app and open offline.
   Bump VERSION whenever you change files so phones get the new version. */
const VERSION = "maryam-v7";
const FILES = [
  "./", "index.html", "config.js", "manifest.webmanifest",
  "css/style.css", "css/features.css", "css/more.css", "css/arcade.css", "css/maryam.css", "css/doniyor.css",
  "js/app.js", "js/shader.js", "js/galaxy3d.js", "js/music.js", "js/game.js", "js/extras.js", "js/more.js", "js/arcade.js", "js/finale.js", "js/maryam.js", "js/arc.js", "js/piano.js", "js/avemaria.js", "js/million.js", "js/fluid.js", "js/blackhole.js", "js/skydata.js", "js/birthsky.js", "js/finale2.js", "js/letterbook.js",
  "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first (so edits show up), fall back to the saved copy when offline
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
