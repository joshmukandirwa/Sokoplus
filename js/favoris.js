import { load, items, favs, paint, bind, ms, notice } from "./market.js";
import { $, $$, esc, store, thumb, tileColor } from "./common.js";
import { myFollows, fmtCount } from "./follow.js";

let loaded = false, tab = "items";
function renderShops() {
  const l = myFollows();
  $("#tShops").textContent = fmtCount(l.length);
  const box = $("#shopList");
  box.innerHTML = l.length ? l.map(s => {
    const logo = thumb(s.logo || "", 96), name = s.shopName || "Boutique";
    return `<div class="shrow"><a class="shl" href="recherche.html?shop=${encodeURIComponent(s.id)}"><span class="sh-av" style="background:${tileColor(name)}">${logo ? `<img src="${esc(logo)}" alt="" draggable="false">` : esc(name[0].toUpperCase())}</span><span class="shn"><b>${esc(name)}</b><small><b data-followers="${esc(s.id)}">–</b> abonnés</small></span></a><button class="btn small ghost" type="button" data-follow="${esc(s.id)}">Abonné ✓</button></div>`;
  }).join("") : '<div class="emptyst"><h2>Aucune boutique suivie</h2><p class="note">Ouvre une boutique et appuie sur « S\'abonner » pour être prévenu de ses nouveaux articles.</p><a class="btn" href="categories.html">Découvrir des boutiques</a></div>';
}
function render() {
  $("#tItems").textContent = favs.size;
  $$("#favTabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.t === tab ? "true" : "false"));
  const shopsTab = tab === "shops";
  $("#shopList").hidden = !shopsTab; $("#grid").hidden = shopsTab;
  if (shopsTab) { $("#empty").hidden = true; $("#clear").hidden = true; renderShops(); return; }
  renderShops();
  const list = [...favs].reverse().map(id => items.get(id)).filter(Boolean);
  const none = loaded && !list.length && !favs.size;
  $("#empty").hidden = !none; $("#clear").hidden = !favs.size;   // « Tout vider » reste là tant qu'il y a des favoris enregistrés
  if (!loaded) { $("#grid").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; return; }
  paint($("#grid"), list);
  if (favs.size) notice($("#grid"), $("#empty"), 1);   // favoris enregistrés mais articles pas chargés : on explique pourquoi
  window.SOKO?.reveal();
}
load(() => { loaded = true; render(); });
bind($("#grid"), render);
document.addEventListener("cur", render);
document.addEventListener("follows", render);
$("#favTabs").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; tab = b.dataset.t; render(); });
$("#clear").addEventListener("click", e => {
  const b = e.currentTarget;
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Tout vider"; }, 3000); return; }
  favs.clear(); store.set("favs", []); document.dispatchEvent(new CustomEvent("favs")); delete b.dataset.sure; b.textContent = "Tout vider"; render();
});
