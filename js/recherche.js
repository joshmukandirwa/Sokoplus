import { load, items, filter, paint, bind, shops, counts, catIcon, notice } from "./market.js";
import { SITE, $, $$, esc, store } from "./common.js";

const p = new URLSearchParams(location.search);
let q = p.get("q") || "", cat = p.get("c") || "Tous", shop = p.get("shop") || "tous", sort = "recent", avail = false, timer, saveT;
const input = $("#q");
input.value = q;
$("#cat").innerHTML = ["Tous", ...SITE.categories].map(c => `<option value="${esc(c)}">${c === "Tous" ? "Toutes les catégories" : esc(c)}</option>`).join("");
$("#cat").value = cat;

const recent = () => store.get("recent", []);
function remember(term) {
  term = term.trim(); if (term.length < 2) return;
  store.set("recent", [term, ...recent().filter(x => x.toLowerCase() !== term.toLowerCase())].slice(0, 8)); idle();
}
function idle() {
  const r = recent(); $("#recentBox").hidden = !r.length;
  $("#recent").innerHTML = r.map(t => `<button class="chipc" data-q="${esc(t)}" type="button">${esc(t)}</button>`).join("");
  const c = counts();
  $("#popular").innerHTML = SITE.categories.map(k => `<button class="chipc" data-c="${esc(k)}" type="button">${catIcon(k)}<span>${esc(k)}</span><small>${c[k] || 0}</small></button>`).join("");
}
function sync() {
  const u = new URLSearchParams(); if (q.trim()) u.set("q", q.trim()); if (cat !== "Tous") u.set("c", cat); if (shop !== "tous") u.set("shop", shop);
  history.replaceState(null, "", u.toString() ? "?" + u : location.pathname);
}
function render() {
  const browsing = q.trim() || cat !== "Tous" || shop !== "tous";
  $("#idle").hidden = browsing; $("#found").hidden = !browsing; $("#qx").hidden = !q;
  if (!browsing) return idle();
  const list = filter({ q, cat, shop, sort, avail });
  paint($("#grid"), list, null);
  $("#empty").hidden = list.length > 0;
  if (notice($("#grid"), $("#empty"), list.length)) $("#count").textContent = "";
  $("#count").textContent = list.length ? `${list.length} résultat${list.length > 1 ? "s" : ""}${q.trim() ? ` pour « ${q.trim()} »` : ""}` : "";
  const tags = [];
  if (shop !== "tous") tags.push(["shop", "Boutique : " + (shops().find(s => s.id === shop)?.name || "")]);
  if (cat !== "Tous") tags.push(["cat", cat]);
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
$("#sort").addEventListener("change", e => { sort = e.target.value; render(); });
$("#avail").addEventListener("change", e => { avail = e.target.checked; render(); });
$("#idle").addEventListener("click", e => {
  const a = e.target.closest("[data-q]"), b = e.target.closest("[data-c]");
  if (a) { q = a.dataset.q; input.value = q; } if (b) cat = b.dataset.c;
  if (a || b) { sync(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
});
$("#recentClear").addEventListener("click", () => { store.set("recent", []); idle(); });
$("#active").addEventListener("click", e => { const b = e.target.closest("[data-clear]"); if (!b) return; if (b.dataset.clear === "shop") shop = "tous"; else cat = "Tous"; sync(); render(); });
document.addEventListener("cur", render);
if (!q && shop === "tous" && cat === "Tous") input.focus();
