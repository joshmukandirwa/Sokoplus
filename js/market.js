/* Données du marché (temps réel ou démo), cartes, favoris, recherche et fiche article : partagés par toutes les pages. */
import { db, collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, serverTimestamp } from "./fb.js";
import { paintGroup } from "./groupbuy.js";
import { SITE, configured, configBanner, $, $$, esc, store, money, waLink, prettyPhone, toast, ago, thumb, tileColor, isNetErr, needNet, NET_MSG } from "./common.js";
import { svg, favBadge } from "./ui.js";
import { icon as ic } from "./icons.js";
import { countryOf, countryName, toUsd } from "./pays.js";
import { renderReviews } from "./avis.js";
import { countView, viewsOf, eyeHTML } from "./vues.js";

export const items = new Map();
export const favs = new Set(store.get("favs", []));
const fresh = new Set(), seen = new Set();
let first = true, unseen = 0, current = null, listeners = [];
export const ms = it => it.createdAt?.toMillis?.() ?? it.createdAt ?? Date.now();
export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/* Ville choisie dans l'en-tête : « Toute l'Afrique » (vide) montre tout. Les anciens articles sans ville sont reconnus par leur adresse. */
export const cityOk = it => {
  const k = store.get("country", ""), c = store.get("city", "");
  if (k && countryOf(it) !== k) return false;
  return !c || it.city === c || (!it.city && norm(it.address).includes(norm(c)));
};
export const placeLabel = () => store.get("city", "") || (store.get("country", "") ? countryName(store.get("country", "")) : "Toute l'Afrique");
const usd = it => toUsd(it.price, it.currency);   // seulement pour classer
const where = it => it.city ? `${it.city}, ${it.address}` : it.address;
const shareUrl = id => new URL("/p/" + encodeURIComponent(id), location.origin).href;   // page d'aperçu (photo, nom, description) pour WhatsApp

/* ---------- Icônes de catégories ---------- */
export const CAT_ICON = {
  "Tous": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  "Mode": '<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  "Alimentation": '<path d="M7 3v7a2 2 0 0 0 2 2v9"/><path d="M5 3v6M11 3v6"/><path d="M17 21V3c-2 1-4 4-4 8h4"/>',
  "Électronique": '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  "Maison": '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  "Beauté": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  "Artisanat": '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-1.5-1-3s1-2 2.5-2H18a3 3 0 0 0 3-3c0-5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  "Immobilier": '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  "Services": '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.2-.5-.5-2.2z"/>',
  "Autre": '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
};
export const catIcon = c => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${CAT_ICON[c] || CAT_ICON.Autre}</svg>`;

/* ---------- Données ---------- */
export function load(onChange) {
  listeners.push(onChange);
  if (listeners.length > 1) { onChange(); return; }
  configBanner();
  const fire = () => { listeners.forEach(f => f()); document.dispatchEvent(new CustomEvent("items")); };   // la cloche de notifications écoute cet événement
  addEventListener("offline", fire); addEventListener("online", fire);   // les pages réaffichent leur message quand le réseau part ou revient
  if (configured) {
    if (navigator.onLine === false) { loadError = "net"; fire(); }       // pas besoin d'attendre 10 s pour le savoir
    let live = false;
    // Affichage rapide : les 24 plus récents arrivent dans une petite requête, sans attendre le flux complet (150).
    try { getDocs(query(collection(db, "items"), orderBy("createdAt", "desc"), limit(24))).then(snap => { if (live || snap.empty) return; snap.forEach(d => { if (!items.has(d.id)) items.set(d.id, { id: d.id, ...d.data() }); }); loadError = ""; fire(); }).catch(() => {}); } catch { /* le flux ci-dessous prend le relais */ }
    try {
      onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc"), limit(150)), snap => {
        if (!snap.metadata.fromCache) live = true;
        // Sans réseau, Firestore renvoie une liste vide « du cache » sans erreur : ce n'est pas « aucun article », c'est « pas de connexion ».
        if (snap.metadata.fromCache && snap.empty && !items.size) { loadError = "net"; fire(); return; }
        snap.docChanges().forEach(ch => {
          const it = { id: ch.doc.id, ...ch.doc.data() };
          if (ch.type === "removed") { items.delete(it.id); return; }
          const isNew = ch.type === "added" && !first && !ch.doc.metadata.hasPendingWrites;
          items.set(it.id, it); if (isNew) announce(it);
        });
        if (!snap.metadata.fromCache) { first = false; loadError = ""; }   // la vraie liste du serveur est arrivée
        fire();
      }, err => { loadError = err.code === "permission-denied" ? "perm" : "net"; fire(); });
    } catch { loadError = "net"; fire(); }
  } else demo(fire);
}
export let loadError = "";

/* Message adapté quand la liste est vide : pas de connexion, marché en mise à jour, ou ville sans article.
   Renvoie true si un message est affiché (la page cache alors son « Rien à voir ici »). */
export function notice(grid, emptyEl, shown = 0) {
  let box = document.getElementById("netbox");
  const city = placeLabel(), hasPlace = !!(store.get("city", "") || store.get("country", ""));
  let kind = "";
  if (!items.size && loadError === "perm") kind = "perm";
  else if (!items.size && (loadError === "net" || navigator.onLine === false)) kind = navigator.onLine === false ? "off" : "back";
  else if (!shown && items.size && hasPlace && [...items.values()].every(i => !cityOk(i))) kind = "city";
  if (!kind) { if (box) box.hidden = true; return false; }
  if (!box) { box = document.createElement("div"); box.id = "netbox"; box.className = "netbox"; box.setAttribute("role", "status"); grid.before(box); }
  const T = {
    off: ["Pas de connexion internet", "Les articles s'afficheront dès que ton réseau reviendra. Vérifie ton Wi-Fi ou tes données mobiles."],
    back: ["Connexion retrouvée", "On charge les articles… Si ça tarde, touche « Réessayer »."],
    perm: ["Le marché est en cours de mise à jour", "Réessaie dans quelques minutes."],
    city: [`Aucun article à ${esc(city)} pour l'instant`, "Tu peux voir les articles de toute l'Afrique en attendant."]
  }[kind];
  box.innerHTML = `<b>${T[0]}</b><p>${T[1]}</p>` + (kind === "city" ? '<button class="btn small" type="button" data-allcity>Voir toute l\'Afrique</button>' : '<button class="btn small" type="button" data-reload>Réessayer</button>');
  box.hidden = false;
  if (kind !== "city") grid.innerHTML = "";
  if (emptyEl) emptyEl.hidden = true;
  return true;
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-allcity]")) return;
  store.set("city", ""); store.set("country", "");
  const dot = $("#cityDot"); if (dot) dot.hidden = true;
  const lbl = $("#regionLbl"); if (lbl) lbl.textContent = "Toute l'Afrique";
  document.dispatchEvent(new CustomEvent("cur"));   // les pages réaffichent leurs listes
});

/* Liens d'images de démonstration (photos libres par mot-clé). Remplace-les par tes propres liens si tu veux.
   Si un lien ne charge pas, la tuile colorée avec la lettre reste affichée. */
const IMG = (kw, n, s = 600) => `https://loremflickr.com/${s}/${s}/${kw}?lock=${n}`;
const DEMO_IMG = ["fabric", "coffee", "charger", "basket", "honey", "headphones", "shirt", "mattress", "soap", "apartment", "smartphone", "saucepan"];
const DEMO_IMG_B = ["textile", "coffeebeans", "powerbank", "wicker"];
const SHOP_KW = { "Mama Zawadi Wax": "fashion", "Kivu Fresh": "grocery", "Goma Tech Corner": "electronics", "Atelier Mapendo": "craft", "Maison Confort": "furniture", "Kivu Beauté": "cosmetics", "Goma Immo": "building" };
function demo(fire) {
  const n = Date.now(), h = 3600e3;
  [
    ["Pagne wax 6 yards", "Mode", 18, "Mama Zawadi Wax", "Ndosho, Goma", "243990000001", .4, 1],
    ["Café du Kivu moulu 500 g", "Alimentation", 9, "Kivu Fresh", "Himbi, Goma", "243810000002", 2],
    ["Power bank 20 000 mAh", "Électronique", 22, "Goma Tech Corner", "Centre-ville, Goma", "243850000003", 5],
    ["Panier tressé du Nord-Kivu", "Artisanat", 16, "Atelier Mapendo", "Katindo, Goma", "243970000004", 9],
    ["Miel pur de Rutshuru 1 L", "Alimentation", 12, "Kivu Fresh", "Himbi, Goma", "243810000002", 26],
    ["Écouteurs Bluetooth", "Électronique", 14, "Goma Tech Corner", "Centre-ville, Goma", "243850000003", 30],
    ["Chemise en pagne homme", "Mode", 25, "Mama Zawadi Wax", "Ndosho, Goma", "243990000001", 34],
    ["Matelas 2 places", "Maison", 85, "Maison Confort", "Birere, Goma", "243820000005", 40],
    ["Savon naturel à l'huile de palme", "Beauté", 4, "Kivu Beauté", "Mikeno, Goma", "243830000006", 48],
    ["Appartement 2 chambres à louer", "Immobilier", 150, "Goma Immo", "Les Volcans, Goma", "243840000007", 55],
    ["Réparation de téléphones", "Services", 5, "Goma Tech Corner", "Centre-ville, Goma", "243850000003", 70],
    ["Casserole en aluminium 5 L", "Maison", 11, "Maison Confort", "Birere, Goma", "243820000005", 80]
  ].forEach(([title, category, price, shopName, address, phone, hrs, featured], i) => items.set("demo" + i, {
    id: "demo" + i, title, category, price, shopName, address, phone, ownerId: shopName,
    images: i < 4 ? [IMG(DEMO_IMG[i], 10 + i), IMG(DEMO_IMG_B[i], 30 + i)] : [IMG(DEMO_IMG[i], 10 + i)],
    shopLogo: IMG(SHOP_KW[shopName], 50 + shopName.length, 200), status: i === 5 ? "sold" : "available", featured: !!featured && i === 0,
    description: "Article d'exemple affiché en mode démo. Configure Firebase pour voir les vrais articles.", createdAt: n - hrs * h
  }));
  first = false; setTimeout(fire, 350);
  setTimeout(() => announce({ id: "demo0", title: "Nouvelle robe wax sur mesure", shopName: "Mama Zawadi Wax" }), 6000);
}

function announce(it) {
  fresh.add(it.id); unseen++; document.title = `(${unseen}) SokoPlus`;
  toast(`Nouveau : ${it.title} · ${it.shopName}`, { onClick: () => openDetail(it.id) });
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    try { new Notification("Nouveau sur SokoPlus", { body: `${it.title} · ${it.shopName}`, icon: "icons/icon-any-192.png" }); } catch { /* ignoré */ }
  }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { unseen = 0; document.title = document.title.replace(/^\(\d+\)\s*/, ""); } });

/* ---------- Suggestions : catégories de tes favoris et mots de tes dernières recherches ---------- */
export const hasTaste = () => favs.size > 0 || store.get("recent", []).length > 0;
export function suggest(n = 6) {
  const cats = new Map(), terms = store.get("recent", []).map(norm).filter(Boolean);
  favs.forEach(id => { const it = items.get(id); if (it) cats.set(it.category, (cats.get(it.category) || 0) + 3); });
  const score = it => (cats.get(it.category) || 0) + terms.reduce((s, t) => s + (norm(`${it.title} ${it.category}`).includes(t) ? 2 : 0), 0)
    + (it.featured ? 1 : 0) + Math.max(0, 1 - (Date.now() - ms(it)) / (14 * 864e5));
  return [...items.values()].filter(it => it.status !== "sold" && !favs.has(it.id) && cityOk(it))
    .sort((a, b) => score(b) - score(a) || ms(b) - ms(a)).slice(0, n);
}

/* ---------- Recherche et filtres ---------- */
export function filter({ cat = "Tous", shop = "tous", q = "", fav = false, sort = "recent", avail = false, kind = "" } = {}) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  const score = it => {
    if (!toks.length) return 0;
    const T = norm(it.title), R = norm(`${it.description || ""} ${it.shopName} ${it.address} ${it.city || ""} ${it.category}`); let s = 0;
    for (const k of toks) { if (T.includes(k)) s += T.startsWith(k) ? 6 : 4; else if (R.includes(k)) s += 1; else return -1; }
    return s;
  };
  const by = { recent: (a, b) => ms(b) - ms(a), low: (a, b) => usd(a) - usd(b), high: (a, b) => usd(b) - usd(a) }[sort] || (() => 0);
  return [...items.values()].map(it => [it, score(it)]).filter(([it, s]) =>
    s >= 0 && (cat === "Tous" || it.category === cat) && (shop === "tous" || it.ownerId === shop) &&
    (!fav || favs.has(it.id)) && (fav || cityOk(it)) && (!avail || it.status !== "sold") &&
    (!kind || (kind === "promo" ? isPromo(it) : kind === "offre" ? isDeal(it) : !!it.certified)))
    .sort(([a, sa], [b, sb]) => (Number(a.status === "sold") - Number(b.status === "sold")) || (toks.length ? sb - sa : 0) ||
      (sort === "recent" ? Number(!!b.featured) - Number(!!a.featured) : 0) || by(a, b)).map(([it]) => it);
}
export function shops() {
  const m = new Map(); items.forEach(i => { if (!cityOk(i)) return; const s = m.get(i.ownerId) || { id: i.ownerId, name: i.shopName, n: 0 }; s.n++; if (i.certified) s.cert = true; if (!s.img) { s.img = i.shopLogo || i.images?.[0] || ""; s.fb = i.shopFb || i.fb?.[0] || ""; } m.set(i.ownerId, s); });
  return [...m.values()].sort((a, b) => b.n - a.n);
}
export const counts = () => { const c = {}; items.forEach(i => { if (cityOk(i)) c[i.category] = (c[i.category] || 0) + 1; }); return c; };

/* ---------- Promotions choisies par le vendeur, certification donnée par SokoPlus ---------- */
export const pct = it => it.oldPrice > it.price ? Math.round((1 - it.price / it.oldPrice) * 100) : 0;
export const isPromo = it => it.tag === "promo" || pct(it) > 0;
export const isDeal = it => it.tag === "offre";
const CHECK = '<img class="ic cert-ic" src="icons/certifie.png" width="16" height="16" alt="Boutique certifiée" title="Boutique certifiée SokoPlus" draggable="false">';
export const certMark = it => it.certified ? CHECK : "";
export const priceHTML = it => `<span class="now">${money(it.price, it.currency)}</span>${it.oldPrice > it.price ? `<s class="old">${money(it.oldPrice, it.currency)}</s><b class="off">-${pct(it)}%</b>` : ""}`;

/* ---------- Cartes ---------- */
export function shopAv(it, size = 20) {
  const src = thumb(it.shopLogo || "", 80);
  return `<span class="sav" style="width:${size}px;height:${size}px;background:${tileColor(it.shopName)}">${src ? `<img src="${esc(src)}" alt="" draggable="false"${it.shopFb ? ` data-fb="${esc(it.shopFb)}"` : ""}>` : esc((it.shopName || "?")[0])}</span>`;
}
export function cardHTML(it, i = 0) {
  const img = thumb(it.images?.[0]), isFav = favs.has(it.id), pop = seen.has(it.id) ? "" : " pop";
  return `<article class="card${fresh.has(it.id) ? " new" : ""}${pop}" style="--i:${Math.min(i, 14)}" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.title)}">
    <button class="fav" data-fav="${esc(it.id)}" aria-pressed="${isFav}" aria-label="Favori">${svg("heart")}</button>
    <div class="thumb" style="background:${tileColor(it.shopName)}"><span>${esc((it.title || "?")[0])}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" draggable="false"${it.fb ? ` data-fb="${esc(it.fb[0])}"` : ""}>` : ""}
      ${it.status === "sold" ? '<em class="badge sold">Vendu</em>' : isDeal(it) ? '<em class="badge deal">Offre du jour</em>' : isPromo(it) ? `<em class="badge bpromo">${pct(it) ? "-" + pct(it) + "%" : "Promo"}</em>` : it.featured ? '<em class="badge">À la une</em>' : ""}</div>
    <div class="in"><h3>${esc(it.title)}</h3><div class="price">${priceHTML(it)}</div>
    <div class="vend sh">${shopAv(it, 16)}<span>${esc(it.shopName)}${certMark(it)}</span></div><div class="vend loc">${esc(where(it))} · ${ago(ms(it))}</div></div></article>`;
}
export function paint(el, list, emptyEl) {
  el.innerHTML = list.map((it, i) => cardHTML(it, i)).join("");
  list.forEach(it => seen.add(it.id));
  if (emptyEl) emptyEl.hidden = list.length > 0;
}
export function toggleFav(id, btn) {
  const on = !favs.has(id); on ? favs.add(id) : favs.delete(id);
  store.set("favs", [...favs]); document.dispatchEvent(new CustomEvent("favs"));
  $$(`[data-fav="${CSS.escape(id)}"]`).forEach(b => { b.setAttribute("aria-pressed", on); if (on) { b.classList.remove("burst"); void b.offsetWidth; b.classList.add("burst"); } });
  return on;
}
/* Branche un conteneur de cartes : favori, ouverture de la fiche. onFav() est appelé après le changement. */
export function bind(el, onFav) {
  el.addEventListener("click", e => {
    const f = e.target.closest("[data-fav]");
    if (f) { e.stopPropagation(); const on = toggleFav(f.dataset.fav, f); toast(on ? "Ajouté aux favoris" : "Retiré des favoris", { ms: 1600 }); onFav && setTimeout(onFav, 380); return; }
    const c = e.target.closest("[data-id]"); if (c) openDetail(c.dataset.id);
  });
  el.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[data-id]")) openDetail(e.target.dataset.id); });
}

/* ---------- Fiche article ---------- */
/* ---------------- Lecteur de la note vocale ---------------- */
const fmtSec = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function paintVoice(el) {
  const a = el._a, tot = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : Number(el.dataset.sec) || 0, cur = a ? a.currentTime : 0;
  el.classList.toggle("on", !!a && !a.paused);
  el.querySelector(".vp-bar i").style.width = (tot ? Math.min(100, cur / tot * 100) : 0) + "%";
  el.querySelector(".vp-t").textContent = fmtSec(cur) + (tot ? " / " + fmtSec(tot) : "");
}
function toggleVoice(el) {
  let a = el._a;
  if (!a) {
    a = el._a = new Audio(el.dataset.src); a.preload = "auto";
    ["timeupdate", "play", "pause", "loadedmetadata"].forEach(ev => a.addEventListener(ev, () => paintVoice(el)));
    a.addEventListener("ended", () => { a.currentTime = 0; paintVoice(el); });
    a.addEventListener("error", () => { el.classList.remove("on"); el.classList.add("err"); el.querySelector(".vp-t").textContent = "Lecture impossible"; });
  }
  document.querySelectorAll("[data-vp]").forEach(o => { if (o !== el && o._a) o._a.pause(); });
  if (a.paused) a.play().catch(() => { el.classList.add("err"); el.querySelector(".vp-t").textContent = "Lecture impossible"; }); else a.pause();
}
function seekVoice(el, e) {
  const a = el._a, bar = el.querySelector(".vp-bar"), tot = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : Number(el.dataset.sec) || 0;
  if (!a || !tot) return;
  const r = bar.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * tot; paintVoice(el);
}
/* ---------------- « Propose ton prix » : le marchandage, sans intermédiaire ---------------- */
const niceRound = (v, ref) => ref >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
function toggleNeg(d) {
  const box = d.querySelector("#negBox"); if (!box) return;
  if (!box.hidden) { box.hidden = true; return; }
  const it = current;
  box.innerHTML = `<h4>Propose ton prix</h4>
    <p class="nsub">Prix affiché : <b>${money(it.price, it.currency)}</b>. Le vendeur te répond sur WhatsApp, il peut accepter, refuser ou te proposer un autre prix.</p>
    <div class="nchips">${[5, 10, 15, 20].map(p => `<button type="button" data-negpct="${p}">-${p} %</button>`).join("")}</div>
    <label class="nfield">Mon prix (${esc(it.currency === "FC" ? "FC" : it.currency || "USD")})<input id="negIn" type="number" inputmode="decimal" min="0" step="any" placeholder="Ex : ${niceRound(it.price * 0.9, it.price)}"></label>
    <p class="nline" id="negLine" aria-live="polite"></p>
    <a class="pdp-wa nsend" data-neggo target="_blank" rel="noopener" aria-disabled="true" href="#">${ic("chat")}<span>Envoyer mon offre sur WhatsApp</span></a>
    <small class="nnote">Reste poli et réaliste : un prix juste a plus de chances d'être accepté. Ne paie jamais avant d'avoir vu l'article.</small>`;
  box.hidden = false; paintNeg(box); box.querySelector("#negIn").focus({ preventScroll: true });
}
function paintNeg(box) {
  if (!box) return;
  const it = current, v = Number(box.querySelector("#negIn").value), line = box.querySelector("#negLine"), go = box.querySelector("[data-neggo]");
  let ok = false, text = "";
  if (!(v > 0)) text = "Choisis une réduction ou écris ton prix.";
  else if (v >= it.price) text = "C'est le prix affiché ou plus : commande directement, sans négocier.";
  else {
    ok = true; const cut = Math.round((1 - v / it.price) * 100);
    text = `Tu proposes ${money(v, it.currency)} : ${money(it.price - v, it.currency)} de moins (-${cut} %).${cut > 40 ? " Offre très basse, le vendeur risque de refuser." : ""}`;
  }
  line.textContent = text; line.className = "nline" + (ok ? " ok" : "");
  go.setAttribute("aria-disabled", ok ? "false" : "true");
  if (ok) {
    const msg = `Bonjour ${it.shopName}, ton article « ${it.title} » est affiché à ${money(it.price, it.currency)} sur SokoPlus. Est-ce que tu peux me le laisser à ${money(v, it.currency)} ? Dis-moi si ça te convient ou si tu me proposes un autre prix. Merci ! ${shareUrl(it.id)}`;
    go.href = waLink(it.phone, msg);
  } else go.href = "#";
}
function dialog() {
  let d = $("#detail"); if (d) return d;
  d = document.createElement("dialog"); d.id = "detail"; d.innerHTML = '<div class="dlg" id="dBody"></div>'; document.body.append(d);
  d.addEventListener("close", () => { const u = new URL(location.href); u.searchParams.delete("item"); history.replaceState(null, "", u.pathname + u.search + u.hash); });
  d.addEventListener("close", () => d.querySelectorAll("[data-vp]").forEach(o => o._a && o._a.pause()));
  d.addEventListener("input", e => { if (e.target.id === "negIn") paintNeg(d.querySelector("#negBox")); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-close]")) return d.close();
    if (e.target.closest("[data-gorev]")) { e.preventDefault(); d.querySelector("#pdRev")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const vpb = e.target.closest("[data-vpbtn]"); if (vpb) { toggleVoice(vpb.closest("[data-vp]")); return; }
    const vpr = e.target.closest("[data-vpbar]"); if (vpr) { seekVoice(vpr.closest("[data-vp]"), e); return; }
    if (e.target.closest("[data-neg]")) { toggleNeg(d); return; }
    const negChip = e.target.closest("[data-negpct]");
    if (negChip) { const box = d.querySelector("#negBox"), p = Number(negChip.dataset.negpct); box.querySelector("#negIn").value = niceRound(current.price * (1 - p / 100), current.price); paintNeg(box); return; }
    const negGo = e.target.closest("[data-neggo]"); if (negGo && negGo.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
    const f = e.target.closest("[data-dfav]");
    if (f) { const on = toggleFav(current.id); f.setAttribute("aria-pressed", on); return; }
    const g = d.querySelector(".gal");
    const nav = e.target.closest("[data-gnav]"); if (nav && g) return g.scrollBy({ left: Number(nav.dataset.gnav) * g.clientWidth, behavior: "smooth" });
    const th = e.target.closest("[data-thumb]"); if (th && g) return g.scrollTo({ left: Number(th.dataset.thumb) * g.clientWidth, behavior: "smooth" });
    const zi = e.target.closest(".pd-main .gal img"); if (zi) return zoom(d, zi.currentSrc || zi.src);
    if (e.target.closest("[data-simshop]")) { d.close(); location.href = `recherche.html?shop=${encodeURIComponent(current.ownerId)}`; return; }
    if (e.target.closest("#shareBtn, [data-share]")) {
      const url = shareUrl(current.id);
      try { if (navigator.share) await navigator.share({ title: current.title, url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } }
      catch { prompt("Copie ce lien :", url); }
    }
    if (e.target.closest("#shopBtn, [data-shop]")) { d.close(); location.href = `recherche.html?shop=${encodeURIComponent(current.ownerId)}`; }
    if (e.target.id === "rSend") {
      if (!configured) return toast("Mode démo : signalement non envoyé.");
      if (!needNet("Pas de connexion : ton signalement n'est pas parti. Réessaie quand le réseau revient.")) return;
      try { await addDoc(collection(db, "reports"), { itemId: current.id, reason: $("#rReason").value, createdAt: serverTimestamp() }); toast("Merci, ton signalement est envoyé."); d.close(); }
      catch (err) { toast(isNetErr(err) ? NET_MSG : "Oups, l'envoi n'a pas marché. Réessaie dans un instant."); }
    }
  });
  return d;
}
/* Produits proches : même catégorie d'abord, puis même boutique, mots du titre en commun, même ville */
function similarTo(it, n = 12) {
  const words = norm(it.title).split(/\s+/).filter(w => w.length > 2);
  const score = x => (x.category === it.category ? 3 : 0) + (x.ownerId === it.ownerId ? 2 : 0) + (x.city && x.city === it.city ? 1 : 0)
    + words.reduce((t, w) => t + (norm(x.title).includes(w) ? 1 : 0), 0);
  return [...items.values()].filter(x => x.id !== it.id && x.status !== "sold" && (x.category === it.category || x.ownerId === it.ownerId))
    .sort((a, b) => score(b) - score(a) || ms(b) - ms(a)).slice(0, n);
}
function zoom(d, src) {
  const z = document.createElement("div"); z.className = "pd-zoom"; z.innerHTML = `<img src="${esc(src)}" alt=""><button type="button" class="x" aria-label="Fermer">×</button>`;
  z.addEventListener("click", () => z.remove()); d.append(z);
}
export function openDetail(id) {
  const it = items.get(id); if (!it) return;
  current = it; fresh.delete(id);
  const d = dialog(), imgs = (it.images || []).map(u => thumb(u, 900)).filter(Boolean);
  const msg = `Bonjour ${it.shopName}, je suis intéressé(e) par « ${it.title} » (${money(it.price, it.currency)}) vu sur SokoPlus : ${shareUrl(id)}`;
  const sim = similarTo(it), many = imgs.length > 1, off = pct(it), sold = it.status === "sold";
  const buy = sold ? '<span class="pdp-sold">Cet article est vendu</span>'
    : `<a class="pdp-call" href="tel:+${esc(String(it.phone).replace(/\D/g, ""))}">${ic("phone")}<span>Appeler</span></a><a class="pdp-wa" href="${esc(waLink(it.phone, msg))}" target="_blank" rel="noopener">${ic("chat")}<span>Commander sur WhatsApp</span></a>`;
  const pay = it.shopPay ? `Accepté par la boutique : ${esc(it.shopPay)}. ` : "Se règle directement avec le vendeur. ";
  const spec = [["Catégorie", it.category], ["Boutique", it.shopName], ["Lieu", where(it)], ["Téléphone", prettyPhone(it.phone)], ["Publié", ago(ms(it))]].filter(r => r[1]);
  $("#dBody").innerHTML = `<div class="pdp">
    <div class="pdp-bar"><div class="pdp-bar-in">
      <button type="button" class="pdp-b" data-close aria-label="Retour">${ic("back")}</button>
      <button type="button" class="pdp-b" data-share aria-label="Partager">${ic("link")}</button>
    </div></div>
    <div class="pdp-grid">
      <div class="pd-media${many ? " many" : ""}">
        <div class="pd-main">
          <div class="gal">${imgs.length ? imgs.map((u, n) => `<img src="${esc(u)}" alt="${esc(it.title)}" draggable="false"${it.fb ? ` data-fb="${esc(it.fb[n] || it.fb[0])}"` : ""}>`).join("") : `<div class="ph" style="background:${tileColor(it.shopName)}">${esc((it.title || "?")[0])}</div>`}</div>
          ${many ? `<button class="pd-nav prev" data-gnav="-1" aria-label="Photo précédente">‹</button><button class="pd-nav next" data-gnav="1" aria-label="Photo suivante">›</button><span class="pd-count" id="gCount">1/${imgs.length}</span>` : ""}
          ${sold ? '<em class="badge sold">Vendu</em>' : ""}
          <button class="fav pdp-fav" data-dfav aria-pressed="${favs.has(id)}" aria-label="Favori">${svg("heart")}</button>
        </div>
        ${many ? `<div class="pd-thumbs">${imgs.map((u, n) => `<button type="button" data-thumb="${n}" class="${n ? "" : "on"}" aria-label="Photo ${n + 1}"><img src="${esc(thumb(it.images[n], 120))}" alt="" draggable="false"></button>`).join("")}</div>` : ""}
      </div>
      <div class="pdp-info">
        <h2 class="pd-title">${esc(it.title)}</h2>
        <div class="pdp-rate" id="pdRate"><span>Publié ${ago(ms(it))}</span></div>
        <div class="pdp-views" id="pdViews" hidden></div>
        <div class="pdp-price${off ? " promo" : ""}">
          ${off ? `<div class="pdp-band"><b>Promo</b><span>-${off}% maintenant</span></div>` : ""}
          <div class="pdp-pbody"><div class="dprice">${priceHTML(it)}${sold ? ' <span class="pill bad">Vendu</span>' : ""}</div>${off ? `<p class="pdp-save">Tu économises ${money(it.oldPrice - it.price, it.currency)}</p>` : ""}</div>
        </div>
        ${sold ? "" : it.negotiable === false ? '<p class="pdp-firm">Prix ferme</p>' : `<button type="button" class="pdp-neg" data-neg>${ic("chat")}<span><b>Propose ton prix</b><small>Prix négociable : discute comme au marché</small></span></button><div class="pdp-negbox" id="negBox" hidden></div>`}
        ${it.groupPrice && !sold ? '<div class="grp" id="grpBox"></div>' : ""}
        <ul class="pdp-svc">
          <li>${ic("chat")}<span><b>Commande directe</b>Discute avec le vendeur sur WhatsApp ou par appel.</span></li>
          <li>${ic("card")}<span><b>Paiement</b>${pay}Ne paie jamais avant d'avoir vérifié l'article.</span></li>
          <li>${ic("pin")}<span><b>Lieu</b>${esc(where(it))}</span></li>
          ${it.meetPlace ? `<li>${ic("pin")}<span><b>Rencontre sûre</b>Remise en main propre : ${esc(it.meetPlace)}. Rencontrez-vous en journée, dans un lieu public.</span></li>` : ""}
          ${it.delivery ? `<li>${ic("shop")}<span><b>Livraison possible</b>Demande les frais et le délai au vendeur sur WhatsApp.</span></li>` : ""}
          ${it.voice ? `<li>${ic("chat")}<span><b>Écoute le vendeur</b><div class="vp" data-vp data-src="${esc(it.voice)}" data-sec="${Number(it.voiceSec) || 0}"><button type="button" class="vp-btn" data-vpbtn aria-label="Écouter la note vocale"><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button><div class="vp-bar" data-vpbar role="slider" aria-label="Position"><i></i></div><span class="vp-t">0:00${it.voiceSec ? " / " + fmtSec(it.voiceSec) : ""}</span></div></span></li>` : ""}
          ${it.swapFor && !sold ? `<li>${ic("chat")}<span><b>Échange accepté</b>Le vendeur accepte d'échanger contre : ${esc(it.swapFor)}. <a class="swap-go" target="_blank" rel="noopener" href="${esc(waLink(it.phone, `Bonjour ${it.shopName}, ton article « ${it.title} » m'intéresse. J'ai quelque chose à te proposer en échange. Je peux t'envoyer des photos ? ${shareUrl(it.id)}`))}">Proposer un échange</a></span></li>` : ""}
        </ul>
      </div>
      <aside class="pdp-side">
        <div class="pd-shop">
          ${shopAv(it, 44)}
          <div><b>${esc(it.shopName)}${certMark(it)}</b><small>${esc(where(it))}</small></div>
          <button class="btn ghost small" id="shopBtn" type="button">Voir la boutique</button>
          <button class="btn small follow" type="button" data-follow="${esc(it.ownerId)}">S'abonner</button>
        </div>
        <div class="pdp-actions">${buy}<button class="btn ghost" id="shareBtn" type="button">Partager</button></div>
      </aside>
    </div>
    <div class="pdp-secs">
      <section class="pdp-sec"><h3 class="pd-h">Description de l'article</h3>
        ${it.description ? `<div class="desc">${esc(it.description)}</div>` : '<p class="pd-empty">Le vendeur n\'a pas ajouté de description.</p>'}
        <dl class="pdp-spec">${spec.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
      </section>
      <section class="pdp-sec"><div class="reviews" id="pdRev"></div></section>
      <section class="pdp-sec"><h3 class="pd-h">Produits similaires</h3>
        ${sim.length ? `<div class="grid pd-sim" id="pdSim">${sim.map((x, i) => cardHTML(x, i)).join("")}</div>`
          : `<p class="pd-empty">Aucun produit similaire pour le moment.</p><button class="btn ghost small" type="button" data-simshop>Voir les articles de ${esc(it.shopName)}</button>`}
      </section>
      <details class="pdp-sec"><summary class="note" style="cursor:pointer">Signaler cet article</summary>
        <div class="row" style="margin-top:8px"><select id="rReason" aria-label="Motif"><option>Arnaque ou faux article</option><option>Article interdit</option><option>Prix faux</option><option>Déjà vendu</option><option>Autre</option></select>
        <button class="btn ghost small" id="rSend">Envoyer</button></div></details>
    </div>
    <div class="pdp-bottom"><button type="button" class="pdp-shopb" data-shop aria-label="Voir la boutique">${ic("shop")}</button>${buy}</div>
  </div>`;
  const g = d.querySelector(".gal");
  if (many && g) g.addEventListener("scroll", () => {
    const i = Math.round(g.scrollLeft / g.clientWidth);
    d.querySelectorAll("[data-thumb]").forEach((b, n) => b.classList.toggle("on", n === i));
    const c = d.querySelector("#gCount"); if (c) c.textContent = `${i + 1}/${imgs.length}`;
  }, { passive: true });
  const sg = d.querySelector("#pdSim"); if (sg) bind(sg);
  const rb = d.querySelector("#pdRev");
  rb.addEventListener("rvdone", ev => {
    const r = d.querySelector("#pdRate"); if (!r) return;
    const { avg, n } = ev.detail, k = Math.round(avg);
    r.innerHTML = (n ? `<span class="st">${"★".repeat(k)}${"☆".repeat(5 - k)}</span><b>${avg.toFixed(1).replace(".", ",")}</b><a href="#pdRev" data-gorev>${n} avis</a>` : "<span>Pas encore d'avis</span>") + `<span>· publié ${ago(ms(it))}</span>`;
  });
  renderReviews(rb, id, it.ownerId, it.title);
  countView("i", id).then(() => viewsOf(id)).then(n => { const e = d.querySelector("#pdViews"); if (e && current && current.id === id) { e.innerHTML = eyeHTML(n) + `<small>${n > 1 ? "personnes ont vu" : "personne a vu"} cet article</small>`; e.hidden = false; } });
  if (!d.open) d.showModal();
  paintGroup(d, it);
  d.scrollTop = 0;
  const u = new URL(location.href); u.searchParams.set("item", id); history.replaceState(null, "", u.pathname + u.search + u.hash);
}
export function openFromUrl() { const id = new URLSearchParams(location.search).get("item"); if (id) openDetail(id); }
export { favBadge };
