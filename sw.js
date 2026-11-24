/* Check Mate service worker: fast opening and use without a connection (e.g. mobile data off at the venue).
   - The app pages and the site's own files (scripts, settings): opened at once from the phone's copy, then checked
     against the server in the background. If something changed, the copy is replaced and the open page is told
     («cm-update»): while it is still opening it reloads by itself, so the new version is shown without a button.
     Requests marked no-store / reload (the version check, the «Νέα έκδοση» button) always go to the server.
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
/* tells the page that is opening (and any open window) that a newer copy is now on the phone; the page may not
   exist yet when the check ends, so it is looked for a few times */
async function tell(id, path){
  for(let k = 0; k < 20; k++){
    const own = id ? await self.clients.get(id) : null;
    const list = own ? [own] : await self.clients.matchAll({type: "window"});
    if(list.length){ list.forEach(c => c.postMessage({type: "cm-update", url: path})); if(own || k > 3) return; }
    await new Promise(ok => setTimeout(ok, 250));
  }
}
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
  /* the app page and its own files: the phone's copy at once; the server's copy is fetched in the background and,
     if it differs, kept and announced to the open pages (they reload while still opening). No copy yet: the server. */
  const key = new Request(url.origin + url.pathname);
  e.respondWith(caches.match(key, {ignoreSearch: true}).then(hit => {
    const old = hit ? hit.clone().text() : null;   // read before the page uses the copy
    /* «no-cache»: the browser checks with the server (a cheap «not modified» answer when nothing changed) instead of
       reusing its own short-lived copy, so a new version is noticed at once */
    const net = fetch(url.href, {cache: "no-cache", credentials: "same-origin"}).then(res => {
      if(!res || !res.ok) return res;
      if(!hit){ e.waitUntil(store(key, res)); return res; }
      e.waitUntil(Promise.all([old, res.clone().text()]).then(([a, b]) => {
        if(a === b) return;
        return store(key, res).then(() => tell(e.resultingClientId || e.clientId, url.pathname));
      }).catch(() => {}));
      return res;
    });
    if(hit){ e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => null).then(res => res || (req.mode === "navigate" ? caches.match(page(req.url)) : null)).then(r => r || Response.error());
  }));
});
