// Mode maintenance : quand l'admin l'active, tout le site est bloqué avec un message et un minuteur.
// Le site se rouvre tout seul à l'heure de fin. L'espace admin n'est jamais bloqué.
import { db, doc, onSnapshot } from "./fb.js";
import { icon } from "./icons.js";

const KEY = "soko_maint", MSG = "SokoPlus fait un petit entretien pour mieux te servir. On revient très vite, merci de ta patience.";
let ov = null, cur = null, timer = 0, frozen = [];
const pad = n => String(n).padStart(2, "0");
const keep = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* stockage indisponible */ } };
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };

function css() {
  if (document.getElementById("mtCss")) return;
  const s = document.createElement("style"); s.id = "mtCss";
  s.textContent = `
#mt{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:auto;padding:max(20px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));color:#fff;text-align:center;
  background:radial-gradient(120% 90% at 85% 0%,#1470ff 0%,#0b1a3a 50%,#03060d 100%);font-family:'Figtree','Segoe UI',system-ui,sans-serif;animation:mtIn .45s ease both}
#mt::after{content:"";position:fixed;right:-80px;bottom:-90px;width:260px;height:260px;border-radius:50%;background:#ff9a00;opacity:.18;filter:blur(14px);pointer-events:none}
#mt .mt-in{position:relative;z-index:1;width:min(440px,100%);display:grid;gap:16px;justify-items:center}
#mt .mt-logo{display:flex;align-items:center;gap:10px;font:900 1.5rem 'Montserrat','Segoe UI',sans-serif;letter-spacing:-.5px}
#mt .mt-logo img{width:44px;height:44px;object-fit:contain}#mt .mt-logo b{color:#18a8ff}
#mt .mt-gear{width:84px;height:84px;border-radius:26px;display:grid;place-items:center;background:#ff9a00;color:#03060d;border:2px solid #fff;box-shadow:0 6px 0 #03060d66;animation:mtWig 2.6s ease-in-out infinite}
#mt .mt-gear svg{width:44px;height:44px}
#mt h1{margin:0;font:900 clamp(1.6rem,7vw,2.1rem)/1.1 'Montserrat','Segoe UI',sans-serif}
#mt .mt-msg{margin:0;font-size:1.02rem;line-height:1.5;opacity:.92;overflow-wrap:anywhere;white-space:pre-line}
#mt .mt-clock{display:flex;gap:8px;justify-content:center;margin-top:4px}
#mt .mt-clock div{min-width:70px;padding:12px 6px 9px;border-radius:16px;background:#ffffff1a;border:1.5px solid #ffffff40;display:grid;gap:2px}
#mt .mt-clock b{font:900 1.9rem/1 'Montserrat','Segoe UI',sans-serif;font-variant-numeric:tabular-nums}
#mt .mt-clock small{font-size:.72rem;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.04em}
#mt .mt-end{margin:0;font-weight:800;color:#ffc766}
#mt .mt-foot{margin:0;font-size:.84rem;opacity:.7}
@keyframes mtIn{from{opacity:0}}
@keyframes mtWig{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@media(prefers-reduced-motion:reduce){#mt,#mt .mt-gear{animation:none}}`;
  document.head.appendChild(s);
}

function show() {
  if (!cur) return;
  css();
  if (!ov) {
    ov = document.createElement("div"); ov.id = "mt"; ov.setAttribute("role", "alertdialog"); ov.setAttribute("aria-live", "polite");
    ov.innerHTML = `<div class="mt-in">
      <div class="mt-logo"><img src="icons/logo-mark.png" alt=""><span>SOKO<b>PLUS</b></span></div>
      <div class="mt-gear">${icon("tools")}</div>
      <h1>Maintenance en cours</h1>
      <p class="mt-msg"></p>
      <div class="mt-clock"><div data-u="d"><b>0</b><small>jours</small></div><div data-u="h"><b>00</b><small>heures</small></div><div data-u="n"><b>00</b><small>min</small></div><div data-u="s"><b>00</b><small>sec</small></div></div>
      <p class="mt-end"></p>
      <p class="mt-foot">Cette page se rouvrira toute seule dès que c'est terminé.</p></div>`;
    document.body.appendChild(ov);
    frozen = [...document.body.children].filter(el => el !== ov && !el.inert);
    frozen.forEach(el => { el.inert = true; });
    document.documentElement.style.overflow = "hidden";
    timer = setInterval(tick, 1000);
  }
  ov.querySelector(".mt-msg").textContent = cur.message || MSG;
  ov.querySelector(".mt-end").textContent = "Retour prévu le " + new Date(cur.until).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  tick();
}
function hide() {
  clearInterval(timer); timer = 0;
  if (!ov) return;
  ov.remove(); ov = null;
  frozen.forEach(el => { el.inert = false; }); frozen = [];
  document.documentElement.style.overflow = "";
}
function tick() {
  if (!ov || !cur) return;
  const ms = cur.until - Date.now();
  if (ms <= 0) { keep(null); cur = null; return hide(); }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), n = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  const set = (u, v) => { const el = ov.querySelector(`[data-u=${u}] b`); if (el.textContent !== v) el.textContent = v; };
  set("d", String(d)); set("h", pad(h)); set("n", pad(n)); set("s", pad(s));
  ov.querySelector("[data-u=d]").style.display = d ? "" : "none";
}

/* Affichage immédiat avec la dernière info connue, puis le serveur confirme ou corrige */
const old = saved();
if (old && old.until > Date.now()) { cur = old; show(); }
if (db) {
  try {
    onSnapshot(doc(db, "config", "maintenance"), s => {
      const d = s.exists() ? s.data() : null, end = d?.until?.toMillis?.() ?? 0;
      if (d?.on && end > Date.now()) { cur = { until: end, message: d.message || "" }; keep(cur); show(); }
      else { cur = null; keep(null); hide(); }
    }, () => { /* hors connexion : on ne bloque pas */ });
  } catch { /* Firebase indisponible : on ne bloque pas */ }
}
