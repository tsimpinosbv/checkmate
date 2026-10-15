/* Check Mate service worker: makes the app installable and lets the page shell open without a connection.
   Pages and files from this site: network first (always the latest version), cached copy when offline.
   Firebase / Google requests are not touched. */
const CACHE = "checkmate-v2";
const SHELL = ["./", "./checkmate.html", "./firebase-config.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
               "./imerologio.html", "./imerologio.webmanifest", "./icons/diary-192.png", "./icons/diary-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match(/imerologio/.test(req.url) ? "./imerologio.html" : "./checkmate.html")))
  );
});
