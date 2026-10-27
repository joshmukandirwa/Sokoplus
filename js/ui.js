/* Couche d'interface partagée : en-tête, barre du bas, protections, animations, langue, hors-ligne.
   Ne dépend d'aucun service externe : elle s'affiche même sans connexion. */
import { $, $$, store, SITE, configured, toast } from "./util.js";

const page = document.body.dataset.page || "";
const HAS_ITEMS = ["home", "categories", "favoris", "recherche"].includes(page);   // pages qui chargent les articles
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Langue (interface) ---------- */
const EN = {
  "nav.home": "Home", "nav.cats": "Categories", "nav.sell": "Sell", "nav.favs": "Favorites", "nav.shop": "My shop", "nav.settings": "Settings",
  "strip.1": "Order on WhatsApp", "strip.2": "Pay with Mobile Money", "strip.3": "Live listings from across the DRC", "strip.4": "Free 30-day trial for sellers",
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
  "gate.in": "I already have an account", "gate.up": "Create my shop for free", "gate.later": "Not now"
};
export const lang = () => store.get("lang", "fr");
export const t = (k, fr) => (lang() === "en" && EN[k]) || fr;
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

/* ---------- En-tête et barre du bas ---------- */
function mount() {
  if (!page || $("header.top")) return;
  const city = store.get("city", "");
  document.body.insertAdjacentHTML("afterbegin", `
  <header class="top"><div class="wrap bar">
    <a class="logo" href="index.html" aria-label="SokoPlus"><img class="mark" src="icons/logo-mark.png" alt=""><span class="wm">SOKO<b>PLUS</b></span></a>
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
    <a href="vendeur.html" data-p="vendeur">${svg("user")}<span data-i18n="nav.shop">Ma boutique</span></a>
  </nav>`);
  $$("[data-p]").forEach(a => { if (a.dataset.p === page) a.setAttribute("aria-current", "page"); });
  $("#cityBtn").onclick = cityDialog; const rc = $("#regionChip"); if (rc) rc.onclick = cityDialog; cityLabel();
  favBadge();
  if (HAS_ITEMS) import("./notifs.js");
}
/* ---------- Région : bouton compact dans l'en-tête, puce sur l'accueil, fenêtre de choix ---------- */
const normTxt = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function cityLabel() {
  const c = store.get("city", "");
  const dot = $("#cityDot"); if (dot) dot.hidden = !c;
  const lbl = $("#regionLbl"); if (lbl) lbl.textContent = c || "Toute la RDC";
}
function citySet(c) {   // les pages réaffichent leurs listes grâce à l'événement « cur » (ancien réglage de devise)
  store.set("city", c); cityLabel();
  document.dispatchEvent(new CustomEvent("cur"));
}
let cityEl;
function cityDialog() {
  const cur = store.get("city", "");
  if (!cityEl) {
    cityEl = document.createElement("dialog"); cityEl.id = "cityDlg"; document.body.append(cityEl);
    cityEl.addEventListener("click", e => {
      if (e.target === cityEl || e.target.closest("[data-close]")) return cityEl.close();
      const b = e.target.closest("[data-city]"); if (!b) return;
      citySet(b.dataset.city); cityEl.close();
      toast(b.dataset.city ? `Région : ${b.dataset.city}. On te montre d'abord ce qui est près de toi.` : "Tu vois maintenant toute la RDC.", { ms: 2200 });
    });
    cityEl.addEventListener("input", e => {
      if (e.target.id !== "cityQ") return;
      const q = normTxt(e.target.value);
      $$("[data-city]", cityEl).forEach(b => { b.hidden = !!q && !normTxt(b.textContent).includes(q); });
    });
  }
  cityEl.innerHTML = `<div class="dlg">
    <div class="dlg-head"><h2>Choisis ta région</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <p class="note">Tu vois d'abord les articles de ta ville. Tu peux changer quand tu veux.</p>
    <input class="cityQ" id="cityQ" type="search" placeholder="Chercher une ville" autocomplete="off" aria-label="Chercher une ville">
    <div class="cityGrid">${["", ...SITE.cities].map(c => `<button type="button" class="cityOpt" data-city="${c}" aria-pressed="${c === cur}">${svg("pin")}<span>${c || "Toute la RDC"}</span></button>`).join("")}</div></div>`;
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

/* Installation (PWA) */
export let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; document.dispatchEvent(new CustomEvent("installable")); });

window.__uiOk = true;
mount(); translate(); reveal();
document.addEventListener("lang", () => translate());
window.SOKO = { translate, reveal };
