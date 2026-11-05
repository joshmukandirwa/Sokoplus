/* Appliqué avant l'affichage : thème clair / sombre / automatique, sans clignotement. */
(function () {
  var d = document.documentElement, mq = matchMedia("(prefers-color-scheme: dark)");
  function get(k, v) { try { var x = localStorage.getItem(k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } }
  function apply() { var m = get("theme", "light"); d.dataset.theme = m === "auto" ? (mq.matches ? "dark" : "light") : m; d.lang = get("lang", "fr"); }
  d.classList.add("js"); setTimeout(function () { if (!window.__uiOk) d.classList.add("rvfail"); }, 3000);
  apply(); mq.addEventListener && mq.addEventListener("change", apply);
  window.__applyTheme = apply;
})();
/* Ambiance de fêtes : appliquée avant le premier affichage (classe, feuille de style, logos) pour éviter le clignotement.
   Même règle que js/ui.js : en marche selon l'admin (noelSite : auto du 5 déc. au 10 janv., on, off). */
(function () {
  var me = document.currentScript;
  if (me && me.getAttribute("data-noel") === "off") return;
  function get(k, v) { try { var x = localStorage.getItem(k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } }
  var v = get("noelSite", "auto"), t = new Date(), mo = t.getMonth(), jo = t.getDate();
  var site = v === "on" || (v !== "off" && ((mo === 11 && jo >= 5) || (mo === 0 && jo <= 10)));
  if (!site) return;
  var d = document.documentElement;
  d.classList.add("noel");
  try { document.write('<link id="noelCss" rel="stylesheet" href="css/noel.css">'); } catch (e) { /* js/noel.js la chargera */ }
  function swap() {
    var a = document.querySelectorAll('img[src$="icons/logo-full.png"]'), b = document.querySelectorAll('.instsheet-ic[src$="icons/logo-mark.png"]'), i;
    for (i = 0; i < a.length; i++) a[i].src = "icons/noel-logo.png";
    for (i = 0; i < b.length; i++) b[i].src = "icons/noel-mark.png";
  }
  var mo = new MutationObserver(swap); mo.observe(d, { childList: true, subtree: true });
  addEventListener("load", function () { swap(); mo.disconnect(); });
})();
/* Maintenance : si elle était en cours à la dernière visite, on cache la page avant son affichage ;
   js/maintenance.js lève le verrou dès que le serveur a répondu (sécurité : levé de toute façon après 4 s). */
(function () {
  var me = document.currentScript;
  if (me && me.getAttribute("data-mt") === "off") return;
  try {
    var m = JSON.parse(localStorage.getItem("soko_maint") || "null");
    if (!m || !(m.until > Date.now())) return;
  } catch (e) { return; }
  var d = document.documentElement, st = document.createElement("style");
  st.textContent = "html.mt-lock{background:var(--bg,#f1f4fb)}html.mt-lock body{visibility:hidden}html.mt-lock #mt{visibility:visible}";
  document.head.appendChild(st);
  d.classList.add("mt-lock");
  setTimeout(function () { d.classList.remove("mt-lock"); }, 4000);
})();
document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-reload]")) location.reload(); });
