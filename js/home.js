import { load, items, filter, paint, bind, counts, shops, catIcon, openFromUrl, notice, suggest, hasTaste } from "./market.js";
import { SITE, $, $$, esc, tileColor, thumb } from "./common.js";
import { countUp } from "./ui.js";

let sort = "recent", opened = false, shown = 0;
const LIMIT = 12;

function render() {
  const grid = $("#grid"), empty = $("#empty");
  const list = filter({ sort });
  paint(grid, list.slice(0, LIMIT), empty);
  notice(grid, empty, list.length);
  $("#moreBtn").hidden = list.length <= LIMIT;
  const sg = hasTaste() ? suggest(4) : [];
  $("#sugsec").hidden = !sg.length;
  if (sg.length) paint($("#sugGrid"), sg);
  if (items.size !== shown) { countUp($("#todayCount"), items.size); shown = items.size; }

  const c = counts();
  $("#cats").innerHTML = SITE.categories.map(k => `<a class="chipc" href="categories.html?c=${encodeURIComponent(k)}">${catIcon(k)}<span>${esc(k)}</span><small>${c[k] || 0}</small></a>`).join("");
  const sh = shops().slice(0, 10);
  $("#shopsec").hidden = !sh.length;
  $("#shops").innerHTML = sh.map(s => `<a class="shopav" href="recherche.html?shop=${encodeURIComponent(s.id)}"><span style="background:${tileColor(s.name)}">${s.img ? `<img src="${esc(thumb(s.img, 160))}" alt="" draggable="false"${s.fb ? ` data-fb="${esc(s.fb)}"` : ""}>` : esc((s.name || "?")[0])}</span><b>${esc(s.name)}</b></a>`).join("");
  window.SOKO?.reveal();
  if (!opened) { opened = true; openFromUrl(); }
}
load(render);
bind($("#grid"));
bind($("#sugGrid"));
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
