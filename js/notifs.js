// Centre de notifications : derniers articles, nouveautés non lues et suggestions. Fonctionne sans serveur.
import { items, ms, suggest, openDetail } from "./market.js";
import { $, esc, store, money, ago, thumb, tileColor, toast } from "./common.js";

const KEY = "notif-seen";
if (!store.get(KEY, 0)) store.set(KEY, Date.now() - 3 * 864e5);   // première visite : les 3 derniers jours comptent comme nouveaux
const seenAt = () => Number(store.get(KEY, 0)) || 0;
const live = () => [...items.values()].filter(it => it.status !== "sold").sort((a, b) => ms(b) - ms(a));
let dlg = null;

function badge() {
  const n = live().filter(it => ms(it) > seenAt()).length, b = $("#bellCnt");
  if (!b) return;
  b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
  if (n) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
}

const row = (it, isNew) => {
  const img = thumb(it.images?.[0], 120);
  return `<button type="button" class="nrow${isNew ? " new" : ""}" data-id="${esc(it.id)}">
    <span class="nimg" style="background:${tileColor(it.shopName)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : esc((it.title || "?")[0])}</span>
    <span class="ntx"><b>${esc(it.title)}</b><small>${money(it.price, it.currency)} · ${esc(it.shopName)}</small><small>${ago(ms(it))}</small></span>
    ${isNew ? '<em class="ntag">Nouveau</em>' : ""}</button>`;
};

function fill() {
  if (!dlg) return;
  const all = live(), seen = seenAt(), latest = all.slice(0, 10), sug = suggest(5);
  $("#nBody").innerHTML =
    `<h3 class="nh">Derniers articles</h3><div class="nlist">${latest.map(it => row(it, ms(it) > seen)).join("") || '<p class="note">Pas encore de nouveautés. Les nouveaux articles apparaîtront ici.</p>'}</div>` +
    (sug.length ? `<h3 class="nh">Suggestions pour toi</h3><div class="nlist">${sug.map(it => row(it, false)).join("")}</div>` : "");
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  $("#nAlert").hidden = perm === "granted" || perm === "unsupported" || perm === "denied";
}

function open() {
  if (!dlg) {
    dlg = document.createElement("dialog"); dlg.id = "notifPanel";
    dlg.innerHTML = `<div class="dlg"><div class="dlg-head"><h2>Notifications</h2><button type="button" class="btn small ghost" data-close>Fermer</button></div>
      <div id="nBody"></div>
      <div class="nfoot"><button type="button" class="btn small ghost" id="nRead">Tout marquer comme lu</button>
        <button type="button" class="btn small" id="nAlert">Activer les alertes</button>
        <a class="btn small ghost" href="parametres.html#notifications">Gérer les alertes</a></div>
      <p class="note">Les nouveaux articles apparaissent ici en direct. Pour être alerté site fermé, active les alertes push dans les réglages.</p></div>`;
    document.body.append(dlg);
    dlg.addEventListener("click", e => {
      if (e.target === dlg || e.target.closest("[data-close]")) return dlg.close();
      const r = e.target.closest(".nrow"); if (r) { dlg.close(); openDetail(r.dataset.id); }
    });
    dlg.addEventListener("close", () => { store.set(KEY, Date.now()); badge(); });
    $("#nRead").onclick = () => { store.set(KEY, Date.now()); badge(); fill(); };
    $("#nAlert").onclick = async () => {
      try { const r = await Notification.requestPermission(); toast(r === "granted" ? "Alertes activées tant que SokoPlus reste ouvert." : "Alertes non autorisées."); } catch { /* ignoré */ }
      fill();
    };
  }
  fill();
  if (!dlg.open) dlg.showModal();
}

$("#bell").addEventListener("click", open);
const update = () => {
  badge(); fill();
  if (new URLSearchParams(location.search).get("notifs") === "1" && items.size) { history.replaceState(null, "", location.pathname); open(); }
};
document.addEventListener("items", update);   // émis par market.js à chaque mise à jour des articles
update();
