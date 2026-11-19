/* Check Mate service worker: fast opening and use without a connection (e.g. mobile data off at the venue).
   - Pages and files of this site: shown at once from the phone's copy, refreshed from the server in the background
     (the «Νέα έκδοση» button appears when a newer version is online). Requests marked no-store / reload
     (the version check and that button) always go to the server.
   - Firebase libraries, fonts and the Excel libraries (fixed versions on Google / cdnjs): kept on the phone.
   - Data (Firestore, sign-in, email) is not touched here: Firestore keeps its own copy on the phone. */
const CACHE = "checkmate-v3";
const SHELL = ["./checkmate.html", "./imerologio.html", "./firebase-config.js", "./manifest.webmanifest", "./imerologio.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/diary-192.png", "./icons/diary-512.png", "/suite-back.js"];
const LIBS = ["https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
              "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
              "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];
const KEEP = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|cdnjs\.cloudflare\.com\/ajax\/libs\/)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    ...SHELL.map(u => c.add(u).catch(() => {})),
    ...LIBS.map(u => fetch(u, {mode: "no-cors"}).then(r => c.put(u, r)).catch(() => {}))
  ])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("checkmate-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (req, res) => { if(res && (res.ok || res.type === "opaque")){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
const page = url => /imerologio/.test(url) ? "./imerologio.html" : "./checkmate.html";

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  /* libraries and fonts (fixed versions): from the phone, from the internet only the first time */
  if(url.origin !== self.location.origin){
    if(!KEEP.test(req.url)) return;
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res))));
    return;
  }
  /* the version check and the «Νέα έκδοση» button: always the server (the button also refreshes the phone's copy) */
  if(req.cache === "no-store" || req.cache === "reload"){
    e.respondWith(fetch(req).then(res => { if(req.cache === "reload") save(new Request(url.origin + url.pathname), res); return res; })
      .catch(() => caches.match(req, {ignoreSearch: true})));
    return;
  }
  /* everything else of this site: the phone's copy at once, refreshed in the background */
  const key = req.mode === "navigate" ? new Request(url.origin + url.pathname) : req;
  e.respondWith(caches.match(key, {ignoreSearch: req.mode === "navigate"}).then(hit => {
    const net = fetch(req).then(res => save(key, res)).catch(() => null);
    if(hit){ e.waitUntil(net); return hit; }
    return net.then(res => res || caches.match(page(req.url)).then(r => r || Response.error()));
  }));
});
