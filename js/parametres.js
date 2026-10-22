import { $, $$, esc, store, SITE, waLink, pushAvailable, pushState, configured, toast } from "./util.js";
import { checkUpdate, applyUpdate, installEvt } from "./ui.js";

const VERSION = "1.0.0";
$("#ver").textContent = VERSION;
$("#help").href = waLink(SITE.adminWhatsapp, "Bonjour SokoPlus, j'ai besoin d'aide.");
const net = () => { const on = navigator.onLine; $("#net").classList.toggle("off", !on); $("#netT").textContent = on ? "En ligne" : "Hors connexion"; };
net(); addEventListener("online", net); addEventListener("offline", net);
$("#cache").onclick = async () => {
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith("sokoplus-")).map(k => caches.delete(k))); say("Données hors connexion effacées. Elles se rechargent à la prochaine visite.", "good"); }
  catch { say("Rien à effacer pour le moment.", "warn"); }
};

/* Boutons segmentés : apparence, langue */
function seg(id, key, def, after) {
  const box = $(id), cur = () => store.get(key, def);
  const paint = () => $$("button", box).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === cur()));
  box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; store.set(key, b.dataset.v); paint(); after && after(b.dataset.v); });
  paint();
}
seg("#segTheme", "theme", "light", () => window.__applyTheme());
seg("#segLang", "lang", "fr", () => { window.__applyTheme(); document.dispatchEvent(new CustomEvent("lang")); toast(store.get("lang", "fr") === "en" ? "Language: English" : "Langue : français", { ms: 1500 }); });

/* Notifications */
function notifUI() {
  const st = pushState(), ok = pushAvailable();
  $("#nInfo").textContent = st ? "Les notifications sont actives sur cet appareil."
    : ok ? "Reçois une alerte à chaque nouvel article, même quand le site est fermé. Sur iPhone, ajoute d'abord le site à l'écran d'accueil."
    : "Tant que SokoPlus est ouvert, tu vois les nouveaux articles apparaître en direct. Les alertes hors-ligne s'activent quand le propriétaire configure l'option push.";
  $("#nOn").hidden = !!st; $("#nOff").hidden = !st;
  $("#nCats").innerHTML = SITE.categories.map(c => `<label class="chip"><input type="checkbox" value="${esc(c)}" ${st?.cats?.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("");
  $("#nCats").hidden = $("[name=scope]:checked").value !== "pick";
}
$$("[name=scope]").forEach(r => r.addEventListener("change", notifUI));
$("#nOn").onclick = async () => {
  const msg = $("#nMsg"); msg.hidden = false; msg.className = "msg"; msg.textContent = "Activation…";
  try {
    if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
    const cats = $("[name=scope]:checked").value === "pick" ? $$("#nCats input:checked").map(i => i.value) : [];
    if (pushAvailable() && configured) { const { enablePush } = await import("./common.js"); await enablePush(cats); }
    else if (!("Notification" in window) || Notification.permission !== "granted") throw new Error("Autorise les notifications dans ton navigateur.");
    msg.className = "msg good"; msg.textContent = pushAvailable() ? "C'est activé. Tu seras alerté même site fermé." : "Alertes activées tant que SokoPlus reste ouvert.";
    notifUI();
  } catch (err) { msg.className = "msg err"; msg.textContent = err.message; }
};
$("#nOff").onclick = async () => { try { const { disablePush } = await import("./common.js"); await disablePush(); } catch { store.set("push", null); } notifUI(); $("#nMsg").hidden = true; };
notifUI();

/* Mises à jour, installation, partage */
const say = (t, kind = "") => { const m = $("#uMsg"); m.hidden = !t; m.className = "msg " + kind; m.textContent = t; };
$("#upd").onclick = async () => {
  say("Recherche de mises à jour…");
  const r = await checkUpdate();
  if (r === "updated") { say("Nouvelle version trouvée. Redémarrage…", "good"); applyUpdate(); }
  else if (r === "latest") say("Tu as déjà la dernière version.", "good");
  else if (r === "offline") say("Impossible de vérifier : pas de connexion.", "warn");
  else say("Les mises à jour automatiques s'activent quand le site est en ligne (https).", "warn");
};
document.addEventListener("sw-update", () => say("Une nouvelle version est prête. Touche « Vérifier les mises à jour ».", "good"));
const showInstall = () => { $("#inst").hidden = !installEvt; };
showInstall(); document.addEventListener("installable", showInstall);
$("#inst").onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; showInstall(); };
$("#share").onclick = async () => {
  const url = new URL("index.html", location.href).href;
  try { if (navigator.share) await navigator.share({ title: "SokoPlus", text: "Tous vos achats, un seul endroit, en RDC.", url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } } catch { /* annulé */ }
};
$("#reset").onclick = e => {
  const b = e.currentTarget;
  if (!b.dataset.sure) { b.dataset.sure = "1"; const o = b.textContent; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = o; }, 3000); return; }
  ["theme", "lang", "cur", "recent"].forEach(k => localStorage.removeItem(k)); location.reload();
};
if (location.hash === "#notifications") $("#notifications").scrollIntoView();
