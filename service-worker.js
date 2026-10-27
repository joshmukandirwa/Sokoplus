/* SokoPlus : fonctionne hors connexion. Augmente VERSION à chaque nouvelle livraison pour déclencher la mise à jour. */
const VERSION = "1.19.2", CACHE = "sokoplus-" + VERSION;
const SHELL = ["index.html", "categories.html", "favoris.html", "recherche.html", "parametres.html", "confidentialite.html", "icons/ebenjosh-logo.png", "vendeur.html", "offline.html", "css/style.css",
  "js/boot.js", "js/ui.js", "js/util.js", "js/common.js", "js/market.js", "js/fb.js", "js/firebase-config.js", "js/home.js", "js/categories.js", "js/favoris.js",
  "js/recherche.js", "js/parametres.js", "js/vendor.js", "js/notify.js", "js/feedback.js", "js/notifs.js", "js/maintenance.js", "js/logout.js", "js/icons.js", "icons/icon-192.png", "icons/logo-mark.png", "icons/logo-full.png", "manifest.json"];
const EXTERNAL = /^https:\/\/(fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com\/firebasejs|res\.cloudinary\.com|loremflickr\.com|live\.staticflickr\.com)\//;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("sokoplus-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {   // pages : réseau d'abord, puis copie locale, puis page hors connexion
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("offline.html"))));
    return;
  }
  if (u.origin === location.origin) {   // fichiers du site : réseau d'abord (toujours la dernière version), copie locale hors connexion
    e.respondWith(fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r)));
    return;
  }
  if (EXTERNAL.test(r.url)) {   // images et polices : copie locale puis mise à jour en arrière-plan
    e.respondWith(caches.match(r).then(m => {
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => m);
      return m || net;
    }));
  }
});
