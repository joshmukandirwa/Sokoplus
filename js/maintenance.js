// Mode maintenance : quand l'admin l'active, tout le site est bloqué avec un message et un minuteur.
// Le site se rouvre tout seul à l'heure de fin. L'espace admin n'est jamais bloqué.
import { db, doc, onSnapshot } from "./fb.js";
import { icon } from "./icons.js";

const KEY = "soko_maint";
let ov = null, cur = null, timer = 0, frozen = [];
const pad = n => String(n).padStart(2, "0");
const keep = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* stockage indisponible */ } };
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };

function css() {
  if (document.getElementById("mtCss")) return;
  const s = document.createElement("style"); s.id = "mtCss";
  s.textContent = `
#mt{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:auto;padding:max(20px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));text-align:center;
  color:var(--ink,#081a3d);background:var(--bg,#f1f4fb);font-family:var(--body,'Figtree','Segoe UI',system-ui,sans-serif);animation:mtIn .4s ease both}
#mt::before{content:"";position:fixed;inset:0;background-image:radial-gradient(var(--soft,#e4ebfa) 2px,transparent 2.5px);background-size:22px 22px;pointer-events:none}
#mt .mt-in{position:relative;z-index:1;width:min(420px,100%);display:grid;gap:18px;justify-items:center}
#mt .mt-logo{height:42px;width:auto;max-width:70%;object-fit:contain}
#mt .mt-stage{position:relative;width:min(300px,86%);height:150px;margin:6px 0 2px}
#mt .mt-stage i{position:absolute;display:grid;place-items:center;border:var(--bw,2px) solid var(--line,#081a3d);box-shadow:0 4px 0 var(--line,#081a3d);color:var(--line,#081a3d)}
#mt .mt-stage i svg{width:55%;height:55%}
#mt .mt-main{left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:28px;background:var(--orange,#ff9a00);animation:mtWig 2.6s ease-in-out infinite}
#mt .mt-main svg{width:46px!important;height:46px!important}
#mt .mt-a,#mt .mt-b,#mt .mt-c{width:52px;height:52px;border-radius:16px}
#mt .mt-a{left:2%;top:8%;background:var(--sky,#18a8ff);transform:rotate(-10deg);animation:mtBob 3.2s ease-in-out infinite}
#mt .mt-b{right:2%;top:2%;background:#fff;transform:rotate(9deg);animation:mtBob 3.8s ease-in-out -1.1s infinite}
#mt .mt-c{right:10%;bottom:0;background:var(--blue,#1470ff);color:#fff;transform:rotate(-6deg);animation:mtBob 3.5s ease-in-out -2s infinite}
#mt .mt-c svg{color:#fff}
#mt h1{margin:0;font:900 clamp(1.7rem,8vw,2.3rem)/1.05 var(--display,'Montserrat','Segoe UI',sans-serif);letter-spacing:-.5px}
#mt h1 span{color:var(--blue,#1470ff);display:inline-block;background:linear-gradient(transparent 62%,#ff9a0066 62%)}
#mt .mt-msg{margin:-4px 0 0;font-size:1rem;line-height:1.45;color:var(--muted,#5b6784);overflow-wrap:anywhere;white-space:pre-line}
#mt .mt-clock{display:flex;gap:10px;justify-content:center}
#mt .mt-clock div{min-width:68px;padding:12px 6px 9px;border-radius:16px;background:var(--surface,#fff);border:var(--bw,2px) solid var(--line,#081a3d);box-shadow:0 4px 0 var(--line,#081a3d);display:grid;gap:3px}
#mt .mt-clock div:nth-child(even){transform:translateY(5px)}
#mt .mt-clock b{font:900 1.8rem/1 var(--display,'Montserrat','Segoe UI',sans-serif);font-variant-numeric:tabular-nums}
#mt .mt-clock small{font-size:.7rem;font-weight:800;color:var(--muted,#5b6784);text-transform:uppercase;letter-spacing:.05em}
#mt .mt-end{margin:8px 0 0;display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:var(--orange,#ff9a00);color:#081a3d;border:var(--bw,2px) solid var(--line,#081a3d);box-shadow:0 3px 0 var(--line,#081a3d);font-weight:800;font-size:.92rem}
#mt .mt-end svg{width:18px;height:18px}
@keyframes mtIn{from{opacity:0}}
@keyframes mtWig{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes mtBob{0%,100%{translate:0 0}50%{translate:0 -9px}}
@media(prefers-reduced-motion:reduce){#mt,#mt .mt-stage i{animation:none}}`;
  document.head.appendChild(s);
}

function show() {
  if (!cur) return;
  css();
  if (!ov) {
    ov = document.createElement("div"); ov.id = "mt"; ov.setAttribute("role", "alertdialog"); ov.setAttribute("aria-live", "polite");
    ov.innerHTML = `<div class="mt-in">
      <img class="mt-logo" src="icons/logo-full.png" alt="SokoPlus">
      <div class="mt-stage" aria-hidden="true">
        <i class="mt-a">${icon("tag")}</i><i class="mt-b">${icon("box")}</i><i class="mt-c">${icon("shop")}</i>
        <i class="mt-main">${icon("tools")}</i>
      </div>
      <h1>On range les <span>rayons</span></h1>
      <p class="mt-msg"></p>
      <div class="mt-clock"><div data-u="d"><b>0</b><small>jours</small></div><div data-u="h"><b>00</b><small>h</small></div><div data-u="n"><b>00</b><small>min</small></div><div data-u="s"><b>00</b><small>sec</small></div></div>
      <p class="mt-end">${icon("clock")}<span></span></p></div>`;
    document.body.appendChild(ov);
    frozen = [...document.body.children].filter(el => el !== ov && !el.inert);
    frozen.forEach(el => { el.inert = true; });
    document.documentElement.style.overflow = "hidden";
    timer = setInterval(tick, 1000);
  }
  const m = ov.querySelector(".mt-msg"); m.textContent = cur.message || ""; m.hidden = !cur.message;
  const end = new Date(cur.until), hm = end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  ov.querySelector(".mt-end span").textContent = end.toDateString() === new Date().toDateString() ? "Retour vers " + hm : "Retour " + end.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + " · " + hm;
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

/* Si une maintenance était en cours à la dernière visite, boot.js cache la page dès le départ (classe mt-lock).
   On attend alors la réponse du serveur (2,5 s au plus) pour afficher la bonne page, sans jamais montrer d'ancienne info.
   Hors connexion ou trop lent : on affiche la dernière info connue. */
const unlock = () => document.documentElement.classList.remove("mt-lock");
const old = saved();
let confirmed = false;
if (old && old.until > Date.now()) {
  cur = old;
  setTimeout(() => { if (!confirmed) { show(); unlock(); } }, 2500);
}
if (db) {
  try {
    onSnapshot(doc(db, "config", "maintenance"), s => {
      confirmed = true;
      const d = s.exists() ? s.data() : null, end = d?.until?.toMillis?.() ?? 0;
      if (d?.on && end > Date.now()) { cur = { until: end, message: d.message || "" }; keep(cur); show(); }
      else { cur = null; keep(null); hide(); }
      unlock();
    }, () => { confirmed = true; if (cur) show(); unlock(); });
  } catch { if (cur) show(); unlock(); }
} else { if (cur) show(); unlock(); }
