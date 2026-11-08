import { load, items, filter, paint, bind, counts, shops, catIcon, catList, bestSellers, cityOk, ms, placeLabel, openFromUrl, notice, suggest, hasTaste, isPromo, isDeal, certMark } from "./market.js";
import { SITE, store, $, $$, esc, tileColor, thumb } from "./common.js";
import { countUp, installEvt } from "./ui.js";
import { initAnnonces } from "./annonces.js";

let sort = "recent", opened = false, shown = 0;
const LIMIT = 18;

function render() {
  const grid = $("#grid"), empty = $("#empty");
  const list = filter({ sort });
  paint(grid, list.slice(0, LIMIT), empty);
  notice(grid, empty, list.length);
  $("#moreBtn").hidden = list.length <= LIMIT;
  /* Rayons choisis par les vendeurs (promotion, offre du jour) : rien ne s'affiche s'il n'y en a pas */
  const avail = filter({ sort: "recent", avail: true });
  const pr = avail.filter(isPromo).slice(0, 10), dl = avail.filter(isDeal).slice(0, 10);
  $("#promoSec").hidden = !pr.length; if (pr.length) paint($("#promoRow"), pr);
  $("#dealSec").hidden = !dl.length; if (dl.length) paint($("#dealRow"), dl);
  /* Rayons automatiques : meilleures ventes, produits près de chez toi (seulement si une ville est choisie) */
  const best = bestSellers(10);
  $("#bestSec").hidden = !best.length; if (best.length) paint($("#bestRow"), best);
  const city = store.get("city", ""), near = city ? avail.filter(it => it.city === city || (!it.city && cityOk(it))).slice(0, 10) : [];
  $("#nearSec").hidden = !near.length; if (near.length) { $("#nearT").textContent = "Produits près de chez vous · " + city; paint($("#nearRow"), near); }
  if (items.size !== shown) { countUp($("#todayCount"), items.size); shown = items.size; }

  const c = counts();
  $("#cats").innerHTML = catList().map(k => `<a class="chipc" href="categories.html?c=${encodeURIComponent(k)}">${catIcon(k)}<span>${esc(k)}</span><small>${c[k] || 0}</small></a>`).join("");
  /* Une seule ligne : les boutiques certifiées d'abord, chaque boutique une seule fois */
  const sh = shops().sort((a, b) => Number(!!b.cert) - Number(!!a.cert)).slice(0, 20);
  $("#shopsec").hidden = !sh.length;
  $("#shops").innerHTML = sh.map(s => `<a class="shopav" href="recherche.html?shop=${encodeURIComponent(s.id)}"><span style="background:${tileColor(s.name)}">${s.img ? `<img src="${esc(thumb(s.img, 160))}" alt="" draggable="false"${s.fb ? ` data-fb="${esc(s.fb)}"` : ""}>` : esc((s.name || "?")[0])}</span><b><em>${esc(s.name)}</em>${s.cert ? certMark({ certified: true }) : ""}</b></a>`).join("");
  window.SOKO?.reveal();
  if (!opened) { opened = true; openFromUrl(); }
}
load(render);
bind($("#grid"));
bind($("#promoRow")); bind($("#dealRow")); bind($("#bestRow")); bind($("#nearRow"));
$("#sort").addEventListener("change", e => { sort = e.target.value; render(); });
document.addEventListener("cur", render);

/* Bannières : points et balayage au doigt (pas de défilement automatique) */
const promos = $("#promos"), dots = $$("#dots i");
const slide = i => { const w = promos.firstElementChild.offsetWidth + 12; promos.scrollTo({ left: i * w, behavior: "smooth" }); };
let idx = 0;
promos.addEventListener("scroll", () => {
  const w = promos.firstElementChild.offsetWidth + 12;
  idx = Math.min(2, Math.round(promos.scrollLeft / w));
  dots.forEach((d, n) => d.classList.toggle("on", n === idx));
}, { passive: true });
dots.forEach((d, n) => d.addEventListener("click", () => slide(n)));

initAnnonces();


/* ---------- Bannière « Installer l'application » (accueil) ---------- */
(function installBanner() {
  const bar = $("#installBar"); if (!bar) return;
  const KEY = "soko-inst-x", WAIT = 3 * 864e5, DELAY = 3500;  // « Plus tard » = on revient dans 3 jours ; elle glisse en bas après 3,5 s, sans pousser le contenu
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const recentlyClosed = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < WAIT; } catch { return false; } };
  const refresh = () => {
    if (standalone || recentlyClosed()) { bar.hidden = true; return; }
    if (ios) $("#installHint").textContent = "Touche Partager, puis « Sur l'écran d'accueil ».";
    const can = !!(installEvt || ios);
    if (!can) { bar.hidden = true; return; }
    if (!bar.hidden || shown) return;
    clearTimeout(t); t = setTimeout(() => { shown = true; bar.hidden = false; requestAnimationFrame(() => bar.classList.add("in")); }, DELAY);
  };
  let t, shown = false;
  const close = () => { bar.classList.remove("in"); setTimeout(() => { bar.hidden = true; }, 250); };
  $("#installBtn").onclick = async () => {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch { /* annulé */ } close(); }
    else if (ios) $("#installHint").textContent = "Touche l'icône Partager de Safari, puis « Sur l'écran d'accueil ».";
  };
  $("#installX").onclick = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* stockage bloqué */ } close(); };
  document.addEventListener("installable", refresh);
  addEventListener("appinstalled", () => { close(); });
  refresh();
})();
