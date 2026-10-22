import { load, items, favs, paint, bind, ms } from "./market.js";
import { $, store } from "./common.js";

let loaded = false;
function render() {
  const list = [...favs].reverse().map(id => items.get(id)).filter(Boolean);
  const none = loaded && !list.length;
  $("#empty").hidden = !none; $("#clear").hidden = !list.length;
  if (!loaded) { $("#grid").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; return; }
  paint($("#grid"), list);
  window.SOKO?.reveal();
}
load(() => { loaded = true; render(); });
bind($("#grid"), render);
document.addEventListener("cur", render);
$("#clear").addEventListener("click", e => {
  const b = e.currentTarget;
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Tout vider"; }, 3000); return; }
  favs.clear(); store.set("favs", []); document.dispatchEvent(new CustomEvent("favs")); delete b.dataset.sure; b.textContent = "Tout vider"; render();
});
