/* Données du marché (temps réel ou démo), cartes, favoris, recherche et fiche article : partagés par toutes les pages. */
import { db, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from "./fb.js";
import { SITE, configured, configBanner, $, $$, esc, store, money, waLink, prettyPhone, toast, ago, thumb, tileColor } from "./common.js";
import { svg, favBadge } from "./ui.js";

export const items = new Map();
export const favs = new Set(store.get("favs", []));
const fresh = new Set(), seen = new Set();
let first = true, unseen = 0, current = null, listeners = [];
export const ms = it => it.createdAt?.toMillis?.() ?? it.createdAt ?? Date.now();
export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/* Ville choisie dans l'en-tête : « Toute la RDC » (vide) montre tout. Les anciens articles sans ville sont reconnus par leur adresse. */
export const cityOk = it => { const c = store.get("city", ""); return !c || it.city === c || (!it.city && norm(it.address).includes(norm(c))); };
const usd = it => it.currency === "FC" ? it.price / SITE.rate : it.price;   // seulement pour classer
const where = it => it.city ? `${it.city}, ${it.address}` : it.address;
const baseUrl = () => new URL("index.html", location.href);
const shareUrl = id => { const u = baseUrl(); u.searchParams.set("item", id); return u.href; };

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
  if (configured) {
    try {
      onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc"), limit(150)), snap => {
        snap.docChanges().forEach(ch => {
          const it = { id: ch.doc.id, ...ch.doc.data() };
          if (ch.type === "removed") { items.delete(it.id); return; }
          const isNew = ch.type === "added" && !first && !ch.doc.metadata.hasPendingWrites;
          items.set(it.id, it); if (isNew) announce(it);
        });
        first = false; fire();
      }, err => { loadError = err.code === "permission-denied" ? "perm" : "net"; fire(); });
    } catch { loadError = "net"; fire(); }
  } else demo(fire);
}
export let loadError = "";

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
    try { new Notification("Nouveau sur SokoPlus", { body: `${it.title} · ${it.shopName}`, icon: "icons/icon-192.png" }); } catch { /* ignoré */ }
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
export function filter({ cat = "Tous", shop = "tous", q = "", fav = false, sort = "recent", avail = false } = {}) {
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
    (!fav || favs.has(it.id)) && (fav || cityOk(it)) && (!avail || it.status !== "sold"))
    .sort(([a, sa], [b, sb]) => (Number(a.status === "sold") - Number(b.status === "sold")) || (toks.length ? sb - sa : 0) ||
      (sort === "recent" ? Number(!!b.featured) - Number(!!a.featured) : 0) || by(a, b)).map(([it]) => it);
}
export function shops() {
  const m = new Map(); items.forEach(i => { if (!cityOk(i)) return; const s = m.get(i.ownerId) || { id: i.ownerId, name: i.shopName, n: 0 }; s.n++; if (!s.img) { s.img = i.shopLogo || i.images?.[0] || ""; s.fb = i.shopFb || i.fb?.[0] || ""; } m.set(i.ownerId, s); });
  return [...m.values()].sort((a, b) => b.n - a.n);
}
export const counts = () => { const c = {}; items.forEach(i => { if (cityOk(i)) c[i.category] = (c[i.category] || 0) + 1; }); return c; };

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
      ${it.status === "sold" ? '<em class="badge sold">Vendu</em>' : it.featured ? '<em class="badge">À la une</em>' : ""}</div>
    <div class="in"><h3>${esc(it.title)}</h3><div class="price">${money(it.price, it.currency)}</div>
    <div class="vend sh">${shopAv(it, 20)}<span>${esc(it.shopName)} · ${esc(where(it))}</span></div><div class="vend">${ago(ms(it))}</div></div></article>`;
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
function dialog() {
  let d = $("#detail"); if (d) return d;
  d = document.createElement("dialog"); d.id = "detail"; d.innerHTML = '<div class="dlg" id="dBody"></div>'; document.body.append(d);
  d.addEventListener("close", () => { const u = new URL(location.href); u.searchParams.delete("item"); history.replaceState(null, "", u.pathname + u.search + u.hash); });
  d.addEventListener("click", async e => {
    if (e.target === d || e.target.closest("[data-close]")) return d.close();
    const f = e.target.closest("[data-dfav]");
    if (f) { const on = toggleFav(current.id); f.setAttribute("aria-pressed", on); return; }
    const s = e.target.closest("[data-sim]"); if (s) return openDetail(s.dataset.sim);
    if (e.target.id === "shareBtn") {
      const url = shareUrl(current.id);
      try { if (navigator.share) await navigator.share({ title: current.title, url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } }
      catch { prompt("Copie ce lien :", url); }
    }
    if (e.target.id === "shopBtn") { d.close(); location.href = `recherche.html?shop=${encodeURIComponent(current.ownerId)}`; }
    if (e.target.id === "rSend") {
      if (!configured) return toast("Mode démo : signalement non envoyé.");
      try { await addDoc(collection(db, "reports"), { itemId: current.id, reason: $("#rReason").value, createdAt: serverTimestamp() }); toast("Merci, ton signalement est envoyé."); d.close(); }
      catch { toast("Oups, l'envoi n'a pas marché. Réessaie dans un instant."); }
    }
  });
  return d;
}
export function openDetail(id) {
  const it = items.get(id); if (!it) return;
  current = it; fresh.delete(id);
  const d = dialog(), imgs = (it.images || []).map(u => thumb(u, 900)).filter(Boolean);
  const msg = `Bonjour ${it.shopName}, je suis intéressé(e) par « ${it.title} » (${money(it.price, it.currency)}) vu sur SokoPlus : ${shareUrl(id)}`;
  const sim = [...items.values()].filter(x => x.id !== id && x.category === it.category && x.status !== "sold").slice(0, 4);
  $("#dBody").innerHTML = `
    <div class="dlg-head"><h2>${esc(it.title)}</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <div class="gal">${imgs.length ? imgs.map((u, n) => `<img src="${esc(u)}" alt="${esc(it.title)}" draggable="false"${it.fb ? ` data-fb="${esc(it.fb[n] || it.fb[0])}"` : ""}>`).join("") : `<div class="ph" style="background:${tileColor(it.shopName)}">${esc((it.title || "?")[0])}</div>`}</div>
    <div class="row between"><div class="dprice">${money(it.price, it.currency)} ${it.status === "sold" ? '<span class="pill bad">Vendu</span>' : ""}</div>
      <button class="fav inl" data-dfav aria-pressed="${favs.has(id)}" aria-label="Favori">${svg("heart")}</button></div>
    ${it.description ? `<div class="desc">${esc(it.description)}</div>` : ""}
    <div class="meta">
      <span class="shl">${shopAv(it, 26)}<span>Boutique : <b>${esc(it.shopName)}</b></span></span><span>Adresse : <b>${esc(where(it))}</b></span>
      <span>Catégorie : <b>${esc(it.category)}</b> · publié ${ago(ms(it))}</span><span>Téléphone : <b>${esc(prettyPhone(it.phone))}</b></span>
    </div>
    <div class="actions">
      ${it.status === "sold" ? "" : `<a class="btn ok" href="${esc(waLink(it.phone, msg))}" target="_blank" rel="noopener">Commander sur WhatsApp</a>
      <a class="btn ghost" href="tel:+${esc(String(it.phone).replace(/\D/g, ""))}">Appeler</a>`}
      <button class="btn ghost" id="shareBtn">Partager</button><button class="btn ghost" id="shopBtn">Voir la boutique</button>
    </div>
    ${sim.length ? `<h3 class="subh">Dans la même catégorie</h3><div class="simrow">${sim.map(s => `<button class="sim" data-sim="${esc(s.id)}"><span style="background:${tileColor(s.shopName)}">${esc((s.title || "?")[0])}${thumb(s.images?.[0], 200) ? `<img src="${esc(thumb(s.images[0], 200))}" alt="" draggable="false"${s.fb ? ` data-fb="${esc(s.fb[0])}"` : ""}>` : ""}</span><b>${esc(s.title)}</b><i>${money(s.price, s.currency)}</i></button>`).join("")}</div>` : ""}
    <p class="note">Paiement en Mobile Money (M-Pesa, Airtel Money, Orange Money) directement au vendeur, après accord sur WhatsApp. Ne paie jamais avant d'avoir vérifié l'article.</p>
    <details><summary class="note" style="cursor:pointer">Signaler cet article</summary>
      <div class="row" style="margin-top:8px"><select id="rReason" aria-label="Motif"><option>Arnaque ou faux article</option><option>Article interdit</option><option>Prix faux</option><option>Déjà vendu</option><option>Autre</option></select>
      <button class="btn ghost small" id="rSend">Envoyer</button></div></details>`;
  if (!d.open) d.showModal();
  const u = new URL(location.href); u.searchParams.set("item", id); history.replaceState(null, "", u.pathname + u.search + u.hash);
}
export function openFromUrl() { const id = new URLSearchParams(location.search).get("item"); if (id) openDetail(id); }
export { favBadge };
