/* Appliqué avant l'affichage : thème clair / sombre / automatique, sans clignotement. */
(function () {
  var d = document.documentElement, mq = matchMedia("(prefers-color-scheme: dark)");
  function get(k, v) { try { var x = localStorage.getItem(k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } }
  function apply() { var m = get("theme", "light"); d.dataset.theme = m === "auto" ? (mq.matches ? "dark" : "light") : m; d.lang = get("lang", "fr"); }
  d.classList.add("js"); setTimeout(function () { if (!window.__uiOk) d.classList.add("rvfail"); }, 3000);
  apply(); mq.addEventListener && mq.addEventListener("change", apply);
  window.__applyTheme = apply;
})();
document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-reload]")) location.reload(); });
