/* Check Mate service worker: fast opening and use without a connection (e.g. mobile data off at the venue).
   - The app pages and the site's own files (scripts, settings): from the server when there is a connection (so the
     latest version is always used, with no «Νέα έκδοση» button), from the phone's copy when there is none or the
     server does not answer within 3 seconds. Requests marked no-store / reload always go to the server.
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

/* keeps a copy on the phone; the promise ends when the copy is stored */
const store = (req, res) => (res && (res.ok || res.type === "opaque")) ? caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {}) : Promise.resolve();
const save = (req, res) => { store(req, res); return res; };
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
    e.respondWith(fetch(req).then(res => req.cache === "reload" ? store(new Request(url.origin + url.pathname), res).then(() => res) : res)
      .catch(() => caches.match(req, {ignoreSearch: true})));
    return;
  }
  /* the app page and its own files (scripts, settings, list of versions…): from the server when there is a
     connection, so a new version is used at once; the phone's copy when offline or the server is slow (3 s) */
  const key = new Request(url.origin + url.pathname);
  let stored = null;
  const net = fetch(req).then(res => { if(res && res.ok){ stored = store(key, res); return res; } throw new Error("http " + (res && res.status)); });
  e.waitUntil(net.then(() => stored, () => {}));   // the copy is kept even if the phone's copy was shown first
  const late = new Promise(ok => setTimeout(ok, 3000)).then(() => caches.match(key, {ignoreSearch: true}));
  e.respondWith(Promise.race([net, late.then(hit => hit || net)]).catch(() =>
    caches.match(key, {ignoreSearch: true}).then(hit => hit || (req.mode === "navigate" ? caches.match(page(req.url)) : null)).then(r => r || Response.error())));
});
