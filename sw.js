/* App-shell cache. Firestore handles data offline on its own. */
const CACHE = "spb-v152";
const SHELL = [
  "./",
  "./app.html",
  "./tailwind.css",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/board.js",
  "./js/drills.js",        /* preset drills — was missing, so they vanished offline */
  "./js/drill-text.js",
  "./js/firebase-config.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(url => new Request(url, { cache: "no-cache" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // let Firebase/CDN requests pass through

  /* Versioned assets carry ?v=NN and an immutable Cache-Control header, so a
     cached copy of a given URL can never be stale — serve it and skip the
     network entirely. That is the whole point of the ?v= ritual, and going to
     the network for them anyway (as this did) threw the benefit away on a phone
     with one bar of reception at a suburban ground. */
  if (url.searchParams.has("v")) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  /* Everything else is network-first so a deploy self-updates, falling back to
     the cache and finally to the APP shell. It used to fall back to
     ./index.html, which is the marketing page — a coach offline on the sideline
     was shown the landing page instead of the app. */
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(m => m || caches.match("./app.html")))
  );
});
