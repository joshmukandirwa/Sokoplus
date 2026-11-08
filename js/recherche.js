import { load, items, filter, paint, bind, shops, counts, catIcon, catList, notice, certMark, isPromo, ms } from "./market.js";
import { SITE, $, $$, esc, store, tileColor, thumb, waLink, prettyPhone, ago, shopInfoHtml, coverCss, configured } from "./common.js";
import { db, doc, getDoc } from "./fb.js";

const p = new URLSearchParams(location.search);
let q = p.get("q") || "", cat = p.get("c") || "Tous", shop = p.get("shop") || "tous", sort = "recent", avail = false, timer, saveT, kind = ["promo", "offre", "cert"].includes(p.get("t")) ? p.get("t") : "";
const input = $("#q");
input.value = q;
$("#cat").innerHTML = ["Tous", ...catList()].map(c => `<option value="${esc(c)}">${c === "Tous" ? "Toutes les catégories" : esc(c)}</option>`).join("");
$("#cat").value = cat;
$("#kind").value = kind;

const recent = () => store.get("recent", []);
function remember(term) {
  term = term.trim(); if (term.length < 2) return;
  store.set("recent", [term, ...recent().filter(x => x.toLowerCase() !== term.toLowerCase())].slice(0, 8)); idle();
}
function idle() {
  const r = recent(); $("#recentBox").hidden = !r.length;
  $("#recent").innerHTML = r.map(t => `<button class="chipc" data-q="${esc(t)}" type="button">${esc(t)}</button>`).join("");
  const c = counts();
  $("#popular").innerHTML = catList().map(k => `<button class="chipc" data-c="${esc(k)}" type="button">${catIcon(k)}<span>${esc(k)}</span><small>${c[k] || 0}</small></button>`).join("");
}
function sync() {
  const u = new URLSearchParams(); if (q.trim()) u.set("q", q.trim()); if (cat !== "Tous") u.set("c", cat); if (shop !== "tous") u.set("shop", shop); if (kind) u.set("t", kind);
  history.replaceState(null, "", u.toString() ? "?" + u : location.pathname);
}
/* En-tête de boutique (quand on ouvre une boutique) : tout vient des articles en ligne, rien d'inventé */
let revShop = "";
/* Profil public de la boutique (couverture, à propos, coordonnées) : lu une seule fois par boutique */
const extras = new Map();
function loadExtra(id) {
  if (extras.has(id) || !configured || !db) return;
  extras.set(id, {});
  getDoc(doc(db, "shops", id)).then(s => { extras.set(id, s.exists() ? s.data() : {}); if (shop === id) shopHead(); }).catch(() => extras.delete(id));
}
function shopHead() {
  const box = $("#shopHead"), mine = shop === "tous" ? [] : [...items.values()].filter(i => i.ownerId === shop);
  box.hidden = !mine.length; if (!mine.length) return;
  const f = mine[0], live = mine.filter(i => i.status !== "sold").length, sold = mine.length - live;
  const since = Math.min(...mine.map(ms)), promos = mine.filter(i => i.status !== "sold" && isPromo(i)).length;
  const logo = thumb(f.shopLogo || "", 160);
  const msg = `Bonjour ${f.shopName}, je vous écris depuis votre boutique sur SokoPlus.`;
  loadExtra(shop);
  const x = extras.get(shop) || {}, info = shopInfoHtml(x);
  box.innerHTML = `<div class="sh-cover" style="${coverCss(x.cover, f.shopName)}"></div>
    <div class="sh-body">
      <span class="sh-av" style="background:${tileColor(f.shopName)}">${logo ? `<img src="${esc(logo)}" alt="" draggable="false">` : esc((f.shopName || "?")[0].toUpperCase())}</span>
      <div class="sh-id"><h2>${esc(f.shopName)}${certMark(f)}</h2>
        <p>${f.certified ? '<span class="pill ok">Boutique certifiée SokoPlus</span> ' : ""}${esc(f.city || "")}${f.city ? " · " : ""}premier article ${esc(ago(since))}</p></div>
      <div class="sh-stats"><span><b data-followers="${esc(shop)}">–</b> abonnés</span><span><b>${live}</b> en ligne</span><span><b>${sold}</b> vendus</span>${promos ? `<span><b>${promos}</b> en promo</span>` : ""}</div>
      ${x.about ? `<p class="sh-about">${esc(x.about)}</p>` : ""}
      ${info ? `<ul class="sh-info">${info}</ul>` : ""}
      <button class="btn follow" type="button" data-follow="${esc(shop)}">S'abonner</button>
      <a class="btn ok" href="${esc(waLink(f.phone, msg))}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
    </div>`;
}
function render() {
  const browsing = q.trim() || cat !== "Tous" || shop !== "tous" || kind;
  $("#idle").hidden = browsing; $("#found").hidden = !browsing; $("#qx").hidden = !q;
  if (!browsing) return idle();
  const list = filter({ q, cat, shop, sort, avail, kind });
  shopHead();
  paint($("#grid"), list, null);
  $("#empty").hidden = list.length > 0;
  if (notice($("#grid"), $("#empty"), list.length)) $("#count").textContent = "";
  $("#count").textContent = list.length ? `${list.length} résultat${list.length > 1 ? "s" : ""}${q.trim() ? ` pour « ${q.trim()} »` : ""}` : "";
  const tags = [];
  if (shop !== "tous") tags.push(["shop", "Boutique : " + (shops().find(s => s.id === shop)?.name || "")]);
  if (cat !== "Tous") tags.push(["cat", cat]);
  if (kind) tags.push(["kind", { promo: "Promotions", offre: "Offres du jour", cert: "Boutiques certifiées" }[kind]]);
  $("#kind").value = kind;
  $("#active").innerHTML = tags.map(([k, v]) => `<button class="tag" data-clear="${k}">${esc(v)} <b>×</b></button>`).join("");
  $("#cat").value = cat;
  clearTimeout(saveT); if (list.length && q.trim().length > 1) saveT = setTimeout(() => remember(q), 1500);
}
load(render);
bind($("#grid"));
input.addEventListener("input", e => { q = e.target.value; clearTimeout(timer); timer = setTimeout(() => { sync(); render(); }, 80); $("#qx").hidden = !q; });
$("#sform").addEventListener("submit", e => { e.preventDefault(); input.blur(); remember(q); sync(); render(); });
$("#qx").addEventListener("click", () => { q = ""; input.value = ""; input.focus(); sync(); render(); });
$("#cat").addEventListener("change", e => { cat = e.target.value; sync(); render(); });
$("#kind").addEventListener("change", e => { kind = e.target.value; sync(); render(); });
$("#sort").addEventListener("change", e => { sort = e.target.value; render(); });
$("#avail").addEventListener("change", e => { avail = e.target.checked; render(); });
$("#idle").addEventListener("click", e => {
  const a = e.target.closest("[data-q]"), b = e.target.closest("[data-c]");
  if (a) { q = a.dataset.q; input.value = q; } if (b) cat = b.dataset.c;
  if (a || b) { sync(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
});
$("#recentClear").addEventListener("click", () => { store.set("recent", []); idle(); });
$("#active").addEventListener("click", e => { const b = e.target.closest("[data-clear]"); if (!b) return; if (b.dataset.clear === "shop") shop = "tous"; else if (b.dataset.clear === "kind") kind = ""; else cat = "Tous"; sync(); render(); });
document.addEventListener("cur", render);
if (!q && shop === "tous" && cat === "Tous" && !kind) input.focus();
