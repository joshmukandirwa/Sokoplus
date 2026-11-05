/* Couche d'interface partagée : en-tête, barre du bas, protections, animations, langue, hors-ligne.
   Ne dépend d'aucun service externe : elle s'affiche même sans connexion. */
import { $, $$, store, SITE, configured, toast, esc, thumb, tileColor } from "./util.js";
import { COUNTRIES, OTHER_CITY, countryName, citiesOf } from "./pays.js";

const page = document.body.dataset.page || "";
const HAS_ITEMS = ["home", "categories", "favoris", "recherche"].includes(page);   // pages qui chargent les articles
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (HAS_ITEMS) import("./follow.js").catch(() => { /* hors connexion : pas d'abonnement */ });

/* ---------- Langue (interface) ---------- */
const EN = {
  "net.off": "No internet connection. Some actions won't work until the network is back.", "net.on": "Back online",
  "nav.home": "Home", "nav.cats": "Categories", "nav.sell": "Sell", "nav.favs": "Favorites", "nav.shop": "My shop", "nav.settings": "Settings",
  "strip.1": "Order on WhatsApp", "strip.2": "Deal directly with the seller", "strip.3": "Live listings from across the DRC", "strip.4": "Free 30-day trial for sellers",
  "home.h1a": "All your shopping,", "home.h1b": "one place.", "search.ph": "Search a product or a shop",
  "home.cats": "Categories", "home.latest": "New arrivals", "home.shops": "Shops", "home.live": "Live", "home.all": "See all",
  "cats.title": "Categories", "cats.sub": "Pick a category to see what the DRC is selling.",
  "favs.title": "Favorites", "favs.sub": "The items you saved, ready when you are.", "favs.clear": "Clear all",
  "search.title": "Search", "search.recent": "Recent searches", "search.popular": "Browse by category",
  "set.title": "Settings", "set.look": "Appearance", "set.light": "Light", "set.dark": "Dark", "set.auto": "Automatic", "set.lang": "Language",
  "set.cur": "Currency", "set.notif": "Notifications", "set.about": "About the app", "set.version": "Version", "set.update": "Updates",
  "set.check": "Check for updates", "set.install": "Install the app", "set.share": "Share SokoPlus", "set.help": "Need help?", "set.reset": "Reset my preferences",
  "set.by": "Created by", "set.tech": "Technical direction", "set.portfolio": "Portfolio", "set.soon": "Coming soon",
  "gate.t": "Check your seller account", "gate.p": "To sell on SokoPlus you need a shop account and to be signed in. Make sure you have an account to continue.",
  "gate.in": "I already have an account", "gate.up": "Create my shop for free", "gate.later": "Not now",
  "set.g.look": "Display", "set.g.priv": "Privacy and security", "set.g.app": "App", "set.g.acc": "My account", "set.g.help": "Help and info"
};
/* Autres langues : traducteur Google (cookie « googtrans », gardé 1 an, actif sur toutes les pages) */
export const GT_LANGS = [
  ["sw", "Kiswahili", "Swahili"], ["ln", "Lingála", "Lingala"], ["pt", "Português", "Portugais"], ["ar", "العربية", "Arabe"],
  ["am", "አማርኛ", "Amharique"], ["ha", "Hausa", "Haoussa"], ["yo", "Yorùbá", "Yoruba"], ["ig", "Igbo", "Igbo"],
  ["zu", "isiZulu", "Zoulou"], ["sn", "chiShona", "Shona"], ["so", "Soomaali", "Somali"], ["rw", "Kinyarwanda", "Kinyarwanda"],
  ["mg", "Malagasy", "Malgache"], ["es", "Español", "Espagnol"], ["zh-CN", "中文", "Chinois"],
  ["af", "Afrikaans", "Afrikaans"], ["om", "Afaan Oromoo", "Oromo"], ["ti", "ትግርኛ", "Tigrigna"], ["wo", "Wolof", "Wolof"],
  ["lg", "Luganda", "Ganda"], ["ny", "Chichewa", "Chichewa"], ["xh", "isiXhosa", "Xhosa"], ["st", "Sesotho", "Sotho du Sud"]
];
const gtCookie = () => { const m = document.cookie.match(/(?:^|; )googtrans=([^;]*)/); return m ? decodeURIComponent(m[1]) : ""; };
export const gtCode = () => { const m = gtCookie().match(/^\/[^/]+\/([^/]+)$/); return m && m[1] !== "fr" ? m[1] : ""; };
export function gtSet(code) {
  const host = location.hostname, doms = /^[\d.]+$/.test(host) || !host.includes(".") ? [""] : ["", `; domain=${host}`, `; domain=.${host}`];
  doms.forEach(d => { document.cookie = code ? `googtrans=/fr/${code}; path=/; max-age=31536000; SameSite=Lax${d}` : `googtrans=; path=/; max-age=0; SameSite=Lax${d}`; });
  store.set("gt", code || null);
}
(function initGt() {
  let code = gtCode(); const saved = store.get("gt", "");
  if (!code && saved) { gtSet(saved); code = saved; }
  if (!code) return;
  document.documentElement.classList.add("gt-on");
  const box = document.createElement("div"); box.id = "google_translate_element"; box.setAttribute("aria-hidden", "true"); document.body ? document.body.appendChild(box) : addEventListener("DOMContentLoaded", () => document.body.appendChild(box));
  window.__gtInit = () => new google.translate.TranslateElement({ pageLanguage: "fr", autoDisplay: false }, "google_translate_element");
  const sc = document.createElement("script"); sc.src = "https://translate.google.com/translate_a/element.js?cb=__gtInit"; sc.async = true; document.head.appendChild(sc);
})();
const DICT = { en: EN };
export const lang = () => gtCode() ? "fr" : store.get("lang", "fr");
export const t = (k, fr) => (DICT[lang()] && DICT[lang()][k]) || fr;
function translate(root = document) {
  $$("[data-i18n]", root).forEach(e => { if (!e.dataset.fr) e.dataset.fr = e.textContent; e.textContent = t(e.dataset.i18n, e.dataset.fr); });
  $$("[data-i18n-ph]", root).forEach(e => { if (!e.dataset.fr) e.dataset.fr = e.getAttribute("placeholder") || ""; e.setAttribute("placeholder", t(e.dataset.i18nPh, e.dataset.fr)); });
}

/* ---------- Icônes ---------- */
const I = {
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'
};
export const svg = (n, c = "") => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- Photo de profil dans la barre du bas ----------
   Quand la personne est connectée, vendor.js garde son nom et sa photo (clé « me »). Sinon : l'icône personne. */
function meIcon() {
  const me = store.get("me", null);
  if (!me || !me.n) return svg("user");
  const inner = me.l ? `<img src="${esc(thumb(me.l, 96))}" alt="" draggable="false">` : esc(me.n[0].toUpperCase());
  return `<span class="meav" style="background:${tileColor(me.n)}">${inner}</span>`;
}

/* ---------- En-tête et barre du bas ---------- */
function mount() {
  if (!page || $("header.top")) return;
  const city = store.get("city", "");
  document.body.insertAdjacentHTML("afterbegin", `
  <header class="top"><div class="wrap bar">
    <a class="logo" href="index.html" aria-label="SokoPlus"><img class="logo-img" src="icons/logo-full.png" alt="SokoPlus, tous vos achats, un seul endroit" width="150" height="49" draggable="false"></a>
    <nav class="dnav" aria-label="Navigation">
      <a href="index.html" data-p="home" data-i18n="nav.home">Accueil</a><a href="categories.html" data-p="categories" data-i18n="nav.cats">Catégories</a>
      <a href="favoris.html" data-p="favoris" data-i18n="nav.favs">Favoris</a><a href="vendeur.html" data-p="vendeur" data-i18n="nav.shop">Ma boutique</a><a href="parametres.html" data-p="parametres" data-i18n="nav.settings">Paramètres</a>
    </nav>
    <div class="nav">
      <button class="iconbtn" id="cityBtn" type="button" aria-label="Choisir ma région">${svg("pin")}<i class="cnt dot" id="cityDot"${city ? "" : " hidden"}></i></button>
      ${HAS_ITEMS ? `<button class="iconbtn" id="bell" type="button" aria-label="Notifications">${svg("bell")}<i class="cnt" id="bellCnt" hidden></i></button>` : `<a class="iconbtn" id="bell" href="index.html?notifs=1" aria-label="Notifications">${svg("bell")}</a>`}
      <a class="iconbtn" href="recherche.html" aria-label="Rechercher">${svg("search")}</a>
    </div>
  </div></header>`);
  document.body.insertAdjacentHTML("beforeend", `
  <nav class="tabbar" aria-label="Navigation principale">
    <a href="index.html" data-p="home">${svg("home")}<span data-i18n="nav.home">Accueil</span></a>
    <a href="categories.html" data-p="categories">${svg("grid")}<span data-i18n="nav.cats">Catégories</span></a>
    <a href="vendeur.html#publier" class="sell" data-sell><span class="pl">${svg("plus")}</span><span data-i18n="nav.sell">Vendre</span></a>
    <a href="favoris.html" data-p="favoris">${svg("heart")}<span data-i18n="nav.favs">Favoris</span><i class="cnt" id="favCnt" hidden></i></a>
    <a href="vendeur.html" data-p="vendeur">${meIcon()}<span data-i18n="nav.shop">Ma boutique</span></a>
  </nav>`);
  $$("[data-p]").forEach(a => { if (a.dataset.p === page) a.setAttribute("aria-current", "page"); });
  $("#cityBtn").onclick = cityDialog; const rc = $("#regionChip"); if (rc) rc.onclick = cityDialog; cityLabel();
  favBadge();
  if (HAS_ITEMS) import("./notifs.js");
}
/* ---------- Région : bouton compact dans l'en-tête, puce sur l'accueil, fenêtre de choix ---------- */
const normTxt = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function cityLabel() {
  const c = store.get("city", ""), k = store.get("country", "");
  const dot = $("#cityDot"); if (dot) dot.hidden = !(c || k);
  const lbl = $("#regionLbl"); if (lbl) lbl.textContent = c || (k ? countryName(k) : "Toute l'Afrique");
}
function citySet(k, c) {   // les pages réaffichent leurs listes grâce à l'événement « cur »
  store.set("country", k); store.set("city", c); cityLabel();
  document.dispatchEvent(new CustomEvent("cur"));
}
let cityEl, pickC = null;   // pickC : pays choisi, on affiche alors ses villes
function drawCity() {
  const curK = store.get("country", ""), curC = store.get("city", "");
  const opt = (attr, val, label, on) => `<button type="button" class="cityOpt" ${attr}="${esc(val)}" aria-pressed="${on}">${svg("pin")}<span>${esc(label)}</span></button>`;
  cityEl.innerHTML = pickC === null
    ? `<div class="dlg">
    <div class="dlg-head"><h2>Choisis ton pays</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <p class="note">Tu vois d'abord les articles de ton pays, puis de ta ville. Tu peux changer quand tu veux.</p>
    <input class="cityQ" id="cityQ" type="search" placeholder="Chercher un pays" autocomplete="off" aria-label="Chercher un pays">
    <div class="cityGrid">${opt("data-country", "", "Toute l'Afrique", !curK)}${COUNTRIES.map(c => opt("data-country", c[0], c[1], c[0] === curK)).join("")}</div></div>`
    : `<div class="dlg">
    <div class="dlg-head"><h2>${esc(countryName(pickC))}</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <p class="note"><button type="button" class="more" data-back>← Changer de pays</button></p>
    <input class="cityQ" id="cityQ" type="search" placeholder="Chercher une ville" autocomplete="off" aria-label="Chercher une ville">
    <div class="cityGrid">${opt("data-city", "", "Tout le pays", curK === pickC && !curC)}${citiesOf(pickC).map(c => opt("data-city", c, c === OTHER_CITY ? "Autres" : c, curK === pickC && c === curC)).join("")}</div></div>`;
}
function cityDialog() {
  if (!cityEl) {
    cityEl = document.createElement("dialog"); cityEl.id = "cityDlg"; document.body.append(cityEl);
    cityEl.addEventListener("click", e => {
      if (e.target === cityEl || e.target.closest("[data-close]")) return cityEl.close();
      if (e.target.closest("[data-back]")) { pickC = null; return drawCity(); }
      const k = e.target.closest("[data-country]");
      if (k) {
        if (!k.dataset.country) { citySet("", ""); cityEl.close(); return toast("Tu vois maintenant toute l'Afrique.", { ms: 2200 }); }
        pickC = k.dataset.country; return drawCity();
      }
      const b = e.target.closest("[data-city]"); if (!b) return;
      citySet(pickC, b.dataset.city); cityEl.close();
      toast(b.dataset.city ? `Région : ${b.dataset.city}. On te montre d'abord ce qui est près de toi.` : `Tu vois maintenant tout le pays : ${countryName(pickC)}.`, { ms: 2200 });
    });
    cityEl.addEventListener("input", e => {
      if (e.target.id !== "cityQ") return;
      const q = normTxt(e.target.value);
      $$("[data-city],[data-country]", cityEl).forEach(b => { b.hidden = !!q && !normTxt(b.textContent).includes(q); });
    });
  }
  const k = store.get("country", ""); pickC = k || null;   // si un pays est déjà choisi, on ouvre directement ses villes
  drawCity();
  cityEl.showModal();
}
export function favBadge() {
  const n = store.get("favs", []).length, b = $("#favCnt"); if (!b) return;
  const had = !b.hidden && b.textContent;
  b.hidden = !n; b.textContent = n;
  if (n && String(had) !== String(n)) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
}
document.addEventListener("favs", favBadge);

/* ---------- Protections : pas de téléchargement d'images, pas de sélection, pas de menu contextuel ---------- */
const typing = el => el && el.closest && el.closest("input,textarea,select,[contenteditable=true]");
document.addEventListener("contextmenu", e => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener("selectstart", e => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener("dragstart", e => { if (e.target.tagName === "IMG" || e.target.tagName === "A") e.preventDefault(); });
document.addEventListener("copy", e => { if (!typing(document.activeElement)) e.preventDefault(); });

/* ---------- Images : si un lien ne charge pas, on masque l'image (la tuile colorée avec la lettre reste visible) ---------- */
addEventListener("error", e => {
  const i = e.target; if (!i || i.tagName !== "IMG") return;
  const f = i.dataset.fb;
  if (f && i.getAttribute("src") !== f) i.src = f; else i.style.display = "none";
}, true);

/* ---------- Animations ---------- */
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("shown"); io.unobserve(en.target); } }), { threshold: .12 }) : null;
export function reveal(root = document) { $$("[data-reveal]:not(.shown)", root).forEach(e => io ? io.observe(e) : e.classList.add("shown")); }
export function countUp(el, to, ms = 500) {
  if (reduce) { el.textContent = to; return; }
  const from = Number(el.textContent) || 0, t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/* Onde au toucher */
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".btn,.cat,.tile,.tabbar a,.seg button,.chip,.iconbtn"); if (!b || reduce) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.6, d = document.createElement("span");
  d.className = "ripple"; d.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === "static") b.style.position = "relative";
  b.classList.add("rip"); b.append(d); setTimeout(() => d.remove(), 650);
}, { passive: true });
/* Inclinaison 3D des cartes (souris uniquement) */
if (matchMedia("(hover:hover)").matches && !reduce) {
  document.addEventListener("pointermove", e => {
    const c = e.target.closest && e.target.closest(".card"); if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-3px)`;
  });
  document.addEventListener("pointerout", e => { const c = e.target.closest && e.target.closest(".card"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });
}
/* Transition de page */
document.addEventListener("click", e => {
  const a = e.target.closest("a[href]"); if (!a || e.defaultPrevented || reduce) return;
  if (a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
  if (a.hasAttribute("data-sell")) return;
});   // le navigateur change de page tout seul, sans fondu ni attente
addEventListener("pageshow", e => { if (e.persisted) document.body.classList.remove("leaving"); });

/* ---------- Vendre : vérifier le compte avant de continuer ---------- */
let gateEl;
function gateDialog() {
  if (gateEl) return gateEl;
  gateEl = document.createElement("dialog"); gateEl.id = "gate";
  gateEl.innerHTML = `<div class="dlg gate">
    <div class="gate-ic">${svg("user")}</div>
    <h2 data-i18n="gate.t">Vérifiez votre compte vendeur</h2>
    <p class="note" data-i18n="gate.p">Pour vendre sur SokoPlus, vous devez avoir une boutique et être connecté. Vérifiez que vous avez un compte pour continuer.</p>
    <a class="btn" href="vendeur.html#connexion" data-i18n="gate.in">J'ai déjà un compte</a>
    <a class="btn warn" href="vendeur.html#inscription" data-i18n="gate.up">Créer ma boutique gratuitement</a>
    <button class="btn ghost" data-close data-i18n="gate.later">Pas maintenant</button></div>`;
  document.body.append(gateEl); translate(gateEl);
  gateEl.addEventListener("click", e => { if (e.target === gateEl || e.target.closest("[data-close], a")) gateEl.close(); });
  return gateEl;
}
function whenAuth() {
  return new Promise(async res => {
    if (!configured) return res(null);
    const to = setTimeout(() => res("slow"), 6000);   // connexion lente : on laisse la page vendeur décider
    try { const { auth, onAuthStateChanged } = await import("./fb.js"); if (!auth) return res(null); const off = onAuthStateChanged(auth, u => { clearTimeout(to); off && off(); res(u); }); }
    catch { res(null); }
  });
}
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-sell]"); if (!a) return;
  e.preventDefault();
  const samePage = new URL(a.href, location.href).pathname === location.pathname;
  const u = await whenAuth();
  if (samePage) {   // déjà sur la page vendeur : pas de rechargement, on montre simplement le bon endroit
    if (u) { const f = document.getElementById("fItem"); (f && !f.closest("[hidden]") ? f : document.body).scrollIntoView({ behavior: "smooth", block: "start" }); }
    else { history.replaceState(null, "", "#publier"); dispatchEvent(new HashChangeEvent("hashchange")); scrollTo({ top: 0, behavior: "smooth" }); }
    return;
  }
  if (u) location.href = a.href;
  else gateDialog().showModal();
});

/* ---------- Hors-ligne et mises à jour ---------- */
let reg;
export async function checkUpdate() {
  if (!("serviceWorker" in navigator)) return "unsupported";
  reg = reg || await navigator.serviceWorker.getRegistration();
  if (!reg) return "none";
  try { await reg.update(); } catch { return "offline"; }
  if (reg.waiting) { reg.waiting.postMessage("SKIP_WAITING"); return "updated"; }
  return "latest";
}
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" }).then(r => {
    reg = r;
    r.addEventListener("updatefound", () => { const w = r.installing; w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) document.dispatchEvent(new CustomEvent("sw-update")); }); });
  }).catch(() => {}));
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (sessionStorage.getItem("soko-reload")) { sessionStorage.removeItem("soko-reload"); location.reload(); } });
}
export const applyUpdate = () => { sessionStorage.setItem("soko-reload", "1"); reg && reg.waiting && reg.waiting.postMessage("SKIP_WAITING"); setTimeout(() => location.reload(), 800); };

/* Avis « Nouvelle version » (toutes les pages) : l'app installée se met à jour en un geste */
(function updateToast() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let box;
  const show = () => {
    if (box || !document.body) return;
    box = document.createElement("div"); box.className = "updtoast"; box.setAttribute("role", "status");
    box.innerHTML = '<span><b>Nouvelle version</b><small>Logo et améliorations prêts.</small></span><button type="button" class="btn small">Mettre à jour</button><button type="button" class="updtoast-x" aria-label="Plus tard">&times;</button>';
    box.querySelector(".btn").onclick = () => { box.querySelector(".btn").textContent = "Mise à jour…"; applyUpdate(); };
    box.querySelector(".updtoast-x").onclick = () => { box.remove(); box = null; };
    document.body.append(box); requestAnimationFrame(() => box.classList.add("in"));
  };
  document.addEventListener("sw-update", show);
  navigator.serviceWorker.getRegistration().then(r => { if (r && r.waiting && navigator.serviceWorker.controller) show(); }).catch(() => {});
  let last = 0;
  const poll = () => { if (document.visibilityState !== "visible" || Date.now() - last < 6e4) return; last = Date.now(); navigator.serviceWorker.getRegistration().then(r => r && r.update().then(() => { if (r.waiting && navigator.serviceWorker.controller) show(); })).catch(() => {}); };
  document.addEventListener("visibilitychange", poll); addEventListener("focus", poll); setTimeout(poll, 2500);
})();

/* Installation (PWA) */
export let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; document.dispatchEvent(new CustomEvent("installable")); });

/* ---------- Bannière « pas de connexion » (toutes les pages) ---------- */
(function netBar() {
  let bar, timer;
  const show = (txt, ok) => {
    if (!bar) { bar = document.createElement("div"); bar.className = "offbar"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite"); document.body.prepend(bar); }
    clearTimeout(timer); bar.textContent = txt; bar.classList.toggle("ok", !!ok); bar.hidden = false;
    if (ok) timer = setTimeout(() => { bar.hidden = true; }, 2500);
  };
  const off = () => show(t("net.off", "Pas de connexion internet. Certaines actions ne marcheront pas tant que le réseau n'est pas revenu."), false);
  addEventListener("offline", off);
  addEventListener("online", () => show(t("net.on", "Connexion retrouvée"), true));
  if (navigator.onLine === false) off();
})();

window.__uiOk = true;
mount(); translate(); reveal();
document.addEventListener("lang", () => translate());
window.SOKO = { translate, reveal };

/* Ambiance de fêtes : réglée par l'admin pour tout le site (Automatique / Activée / Désactivée), ou choisie dans Paramètres.
   Automatique = du 1er décembre au 10 janvier. ?noel=1 / ?noel=0 pour essayer sur ton téléphone. */
(function festive() {
  if (/admin\.html|\/admin\/?$/.test(location.pathname)) return;
  try { const q = new URLSearchParams(location.search).get("noel"); if (q === "1" || q === "0") store.set("noel", q === "1" ? "on" : "off"); } catch { /* adresse illisible */ }
  const d = new Date(), season = d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 10);
  const decide = () => {
    const mine = store.get("noel", "auto"), site = store.get("noelSite", "auto");
    if (mine === "on" || mine === "off") return mine === "on";
    return site === "on" || (site === "auto" && season);
  };
  const active = decide();
  if (active) import("./noel.js").catch(() => { /* décor facultatif */ });
  /* Réglage du site : on le lit sur le serveur ; s'il change, la page se recharge une fois pour l'appliquer */
  import("./fb.js").then(({ db, doc, onSnapshot }) => {
    if (!db) return;
    onSnapshot(doc(db, "config", "theme"), s => {
      const v = s.exists() ? s.data().festive : "auto", old = store.get("noelSite", "auto");
      if (v !== "on" && v !== "off") { if (old !== "auto") { store.set("noelSite", "auto"); if (decide() !== active) location.reload(); } return; }
      if (v !== old) { store.set("noelSite", v); if (decide() !== active) location.reload(); }
    }, () => { /* hors connexion : on garde le dernier réglage connu */ });
  }).catch(() => { });
})();
