import { load, items, filter, paint, bind, counts, shops, catIcon, openFromUrl, loadError, suggest, hasTaste } from "./market.js";
import { SITE, $, $$, esc, tileColor, thumb } from "./common.js";
import { countUp } from "./ui.js";

let sort = "recent", opened = false, shown = 0;
const LIMIT = 12;

function render() {
  const grid = $("#grid"), empty = $("#empty");
  if (loadError && !items.size) {
    grid.innerHTML = ""; empty.hidden = false;
    empty.textContent = loadError === "perm" ? "Accès refusé : colle les règles de firestore.rules dans la console Firebase (README, étape 4)." : "Impossible de charger les articles. Vérifie ta connexion.";
    return;
  }
  const list = filter({ sort });
  paint(grid, list.slice(0, LIMIT), empty);
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

/* Bannières : points + défilement automatique */
const promos = $("#promos"), dots = $$("#dots i");
const slide = i => { const w = promos.firstElementChild.offsetWidth + 12; promos.scrollTo({ left: i * w, behavior: "smooth" }); };
let idx = 0, paused = 0;
promos.addEventListener("scroll", () => {
  const w = promos.firstElementChild.offsetWidth + 12;
  idx = Math.min(2, Math.round(promos.scrollLeft / w));
  dots.forEach((d, n) => d.classList.toggle("on", n === idx));
}, { passive: true });
["pointerdown", "touchstart", "wheel"].forEach(ev => promos.addEventListener(ev, () => { paused = Date.now() + 9000; }, { passive: true }));
dots.forEach((d, n) => d.addEventListener("click", () => slide(n)));
if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
  setInterval(() => { if (document.hidden || Date.now() < paused || promos.scrollWidth <= promos.clientWidth + 8) return; slide((idx + 1) % 3); }, 5000);
