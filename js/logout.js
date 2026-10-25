// Bouton « Déconnexion » : animation au toucher, fenêtre de confirmation, puis au revoir animé.
import { run } from "./feedback.js";

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="lo-door"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g><g class="lo-arrow"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></g></svg>';
let dlg = null, pending = null, nameOf = () => "";
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* pas de vibreur */ } };
const wait = ms => new Promise(r => setTimeout(r, ms));

function css() {
  if (document.getElementById("loCss")) return;
  const s = document.createElement("style"); s.id = "loCss";
  s.textContent = `
.lo-tap{animation:loTap .55s cubic-bezier(.3,1.4,.5,1)}
@keyframes loTap{0%{transform:scale(1)}25%{transform:scale(.9)}60%{transform:translateX(8px) scale(1.03)}100%{transform:none}}
#loDlg .dlg{align-items:center;text-align:center;gap:12px}
#loDlg .lo-ic{width:84px;height:84px;border-radius:26px;display:grid;place-items:center;background:var(--orange);color:var(--night);border:var(--bw) solid var(--line);box-shadow:0 5px 0 var(--line);overflow:hidden}
#loDlg .lo-ic svg{width:44px;height:44px;overflow:visible}
#loDlg .lo-door{transform-origin:3px 12px}
#loDlg[open] .lo-arrow{animation:loIdle 1.6s .4s ease-in-out infinite}
@keyframes loIdle{0%,100%{transform:translateX(0)}45%{transform:translateX(4px)}}
#loDlg.go .lo-arrow{animation:loGo .6s ease-in forwards}
#loDlg.go .lo-door{animation:loDoor .5s ease-in-out forwards}
@keyframes loGo{40%{transform:translateX(-4px)}100%{transform:translateX(34px);opacity:0}}
@keyframes loDoor{50%{transform:scaleX(.55)}100%{transform:scaleX(1)}}
#loDlg h2{margin:0;font:900 1.35rem var(--display);overflow-wrap:anywhere}
#loDlg p{margin:0;color:var(--muted)}
#loDlg .wnav{width:100%}
#loDlg.go .wnav,#loDlg.go p{opacity:.0;transition:opacity .25s}
#loDlg.bye{animation:loBye .3s ease-in forwards}
@keyframes loBye{to{transform:translateY(40px);opacity:0}}
@media(prefers-reduced-motion:reduce){.lo-tap,#loDlg[open] .lo-arrow,#loDlg.go .lo-arrow,#loDlg.go .lo-door,#loDlg.bye{animation:none}}`;
  document.head.appendChild(s);
}

function build() {
  css();
  dlg = document.createElement("dialog"); dlg.id = "loDlg";
  dlg.innerHTML = `<div class="dlg"><div class="lo-ic">${ICON}</div><h2></h2><p>Tu pourras te reconnecter quand tu veux avec ton numéro ou ton e-mail.</p>
    <div class="wnav"><button class="btn warn" type="button" data-ok>Me déconnecter</button><button class="btn ghost" type="button" data-no>Rester connecté</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("cancel", e => { if (dlg.classList.contains("go")) e.preventDefault(); });
  dlg.addEventListener("click", async e => {
    if (dlg.classList.contains("go")) return;
    if (e.target === dlg || e.target.closest("[data-no]")) return dlg.close();
    const ok = e.target.closest("[data-ok]"); if (!ok || !pending) return;
    const name = nameOf(), h = dlg.querySelector("h2");
    try {
      buzz([20, 40, 20]);
      await run(ok, async () => { await pending(); dlg.classList.add("go"); h.textContent = name ? `À bientôt, ${name} !` : "À bientôt !"; }, { busy: "Déconnexion…", done: "Fait", hold: 1100 });
      dlg.classList.add("bye"); await wait(300);
      dlg.close(); dlg.classList.remove("go", "bye");
    } catch { dlg.classList.remove("go"); ok.textContent = "Réessayer"; }
  });
}

export function bindLogout(btn, doSignOut, getName = () => "") {
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!dlg) build();
    pending = doSignOut; nameOf = getName;
    const name = nameOf();
    dlg.querySelector("h2").textContent = name ? `Tu pars déjà, ${name} ?` : "Tu pars déjà ?";
    dlg.querySelector("[data-ok]").textContent = "Me déconnecter";
    btn.classList.remove("lo-tap"); void btn.offsetWidth; btn.classList.add("lo-tap");
    buzz(15);
    setTimeout(() => dlg.showModal(), 200);   // laisse l'animation du bouton se voir avant d'ouvrir la fenêtre
  });
}
