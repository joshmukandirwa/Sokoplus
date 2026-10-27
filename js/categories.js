import { load, items, filter, paint, bind, counts, catIcon, notice } from "./market.js";
import { SITE, $, $$, esc } from "./common.js";

const p = new URLSearchParams(location.search);
let cat = p.get("c") || "", sort = "recent", avail = false, built = false;

function tiles() {
  const c = counts();
  $("#tiles").innerHTML = ["Tous", ...SITE.categories].map((k, i) =>
    `<button class="tile" style="--i:${i}" data-cat="${esc(k)}" aria-pressed="${k === cat}">${catIcon(k)}<b>${k === "Tous" ? "Tous les articles" : esc(k)}</b><small>${k === "Tous" ? items.size : (c[k] || 0)} article${(k === "Tous" ? items.size : c[k]) > 1 ? "s" : ""}</small></button>`).join("");
}
function results() {
  const res = $("#res"); res.hidden = !cat; if (!cat) return;
  const list = filter({ cat, sort, avail });
  $("#resT").textContent = cat === "Tous" ? "Tous les articles" : cat;
  $("#resN").textContent = `${list.length} article${list.length > 1 ? "s" : ""}`;
  paint($("#grid"), list, $("#empty"));
  notice($("#grid"), $("#empty"), list.length);
}
function render() { if (!built || items.size) tiles(); built = true; results(); window.SOKO?.reveal(); }
load(render);
bind($("#grid"));
$("#tiles").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]"); if (!b) return;
  cat = b.dataset.cat;
  $$("#tiles .tile").forEach(t => t.setAttribute("aria-pressed", t === b));
  history.replaceState(null, "", `?c=${encodeURIComponent(cat)}`);
  results(); setTimeout(() => $("#res").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
});
$("#sort").addEventListener("change", e => { sort = e.target.value; results(); });
$("#avail").addEventListener("change", e => { avail = e.target.checked; results(); });
document.addEventListener("cur", results);
