/* Annonces officielles de SokoPlus (publiées par l'admin) : bandeau en haut de l'accueil + fiche complète.
   Tout est lu en direct ; rien ne s'affiche s'il n'y a aucune annonce en cours. */
import { db, collection, query, orderBy, limit, onSnapshot } from "./fb.js";
import { configured } from "./util.js";
import { $, $$, esc, ago, thumb, toast } from "./common.js";
import { icon } from "./icons.js";
import { countView, eyeHTML } from "./vues.js";

export const KINDS = { annonce: "Annonce", communique: "Communiqué", important: "Important" };
let list = [], sig = "", dlg = null, io = null;

const ms = a => a.createdAt?.toMillis?.() ?? Date.now();
const live = a => { const e = a.expiresAt?.toMillis?.(); return !e || e > Date.now(); };
const kind = a => KINDS[a.kind] ? a.kind : "annonce";
/* Résumé de la carte : si le message est une liste (lignes commençant par - ou •), on affiche les titres des points ; sinon le début du texte */
const snippet = t => {
  const lines = String(t || "").split("\n").map(l => l.trim()).filter(Boolean);
  const items = lines.filter(l => /^[-•*]\s+/.test(l)).map(l => l.replace(/^[-•*]\s+/, "").split(/\s*:\s*/)[0].trim()).filter(Boolean);
  const s = (items.length >= 2 ? items.join(" · ") : lines.join(" ")).replace(/\s+/g, " ").trim();
  return s.length > 120 ? s.slice(0, 117).trimEnd() + "…" : s;
};
/* Texte de l'annonce : retours à la ligne conservés, liens https cliquables (le reste est échappé) */
export const fmtText = t => esc(t || "").replace(/\n/g, "<br>").replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

function cardHTML(a) {
  const img = a.images?.[0] ? thumb(a.images[0], 700) : "";
  const k = kind(a);
  return `<article class="annc k-${k}" data-id="${esc(a.id)}" tabindex="0" role="button" aria-label="${esc(KINDS[k] + " : " + a.title)}">
    <div class="annc-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" draggable="false">` : `<img class="annc-mark" src="icons/logo-mark.png" alt="" draggable="false">`}</div>
    <div class="annc-in"><h3>${esc(a.title)}</h3>${a.text ? `<p>${esc(snippet(a.text))}</p>` : ""}
      <div class="annc-foot"><span>${esc(ago(ms(a)))}</span><span data-eye="${esc(a.id)}">${eyeHTML(a.views || 0)}</span></div></div></article>`;
}

function paint() {
  const sec = $("#annSec"); if (!sec) return;
  const show = list.filter(live);
  sec.hidden = !show.length;
  const next = show.map(a => `${a.id}|${a.title}|${a.text}|${(a.images || []).join(",")}|${a.kind}`).join("§");
  if (next !== sig) {   // vraie nouveauté : on redessine ; sinon (simple +1 vue) on ne touche qu'aux chiffres
    sig = next;
    $("#annRow").innerHTML = show.map(cardHTML).join("");
    $("#annRow").classList.toggle("one", show.length === 1);
    watch();
  } else show.forEach(a => { const e = $(`[data-eye="${CSS.escape(a.id)}"]`); if (e) e.innerHTML = eyeHTML(a.views || 0); });
}

/* Une annonce compte comme « vue » quand elle s'affiche vraiment à l'écran (au moins 60 %) */
function watch() {
  io?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const id = e.target.dataset.id;
    countView("a", id).then(added => { if (!added) return; const a = list.find(x => x.id === id); if (a) { a.views = (a.views || 0) + 1; const s = $(`[data-eye="${CSS.escape(id)}"]`); if (s) s.innerHTML = eyeHTML(a.views); } });
  }), { threshold: .6 });
  $$("#annRow .annc").forEach(c => io.observe(c));
}

function dialog() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog"); dlg.id = "annDlg"; dlg.innerHTML = '<div class="dlg" id="annBody"></div>'; document.body.append(dlg);
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest("[data-close]")) { dlg.close(); return; }
    if (e.target.closest("[data-ashare]")) { shareAnnonce(); return; }
    const g = dlg.querySelector(".agal"), nav = e.target.closest("[data-anav]");
    if (nav && g) g.scrollBy({ left: Number(nav.dataset.anav) * g.clientWidth, behavior: "smooth" });
  });
  dlg.addEventListener("close", () => { const u = new URL(location.href); u.searchParams.delete("annonce"); history.replaceState(null, "", u.pathname + u.search + u.hash); });
  return dlg;
}

let openId = "";
async function shareAnnonce() {   // lien /a/ID : WhatsApp y lit l'affiche et le titre de l'annonce
  const a = list.find(x => x.id === openId); if (!a) return;
  const url = new URL("/a/" + encodeURIComponent(a.id), location.origin).href;
  try { if (navigator.share) await navigator.share({ title: a.title, url }); else { await navigator.clipboard.writeText(url); toast("Lien copié"); } } catch { /* partage annulé */ }
}
export function openAnnonce(id) {
  const a = list.find(x => x.id === id); if (!a) return;
  openId = id;
  const d = dialog(), imgs = (a.images || []).map(u => thumb(u, 1000)).filter(Boolean), k = kind(a);
  countView("a", id).then(added => { if (added) { a.views = (a.views || 0) + 1; const s = d.querySelector("[data-eyebox]"); if (s) s.innerHTML = eyeHTML(a.views); } });
  $("#annBody").innerHTML = `<div class="dlg-head"><span class="annc-official"><img src="icons/certifie.png" width="16" height="16" alt="" draggable="false"> Publié par l'équipe SokoPlus</span><span class="a-hbtns"><button class="x" type="button" data-ashare aria-label="Partager cette annonce">${icon("link")}</button><button class="x" type="button" data-close aria-label="Fermer">×</button></span></div>
    ${imgs.length ? `<div class="agal-w"><div class="agal">${imgs.map(u => `<img src="${esc(u)}" alt="" draggable="false">`).join("")}</div>${imgs.length > 1 ? `<button class="pd-nav prev" data-anav="-1" aria-label="Image précédente">‹</button><button class="pd-nav next" data-anav="1" aria-label="Image suivante">›</button>` : ""}</div>` : ""}
    <div class="a-meta2"><em class="annc-kind k-${k}">${esc(KINDS[k])}</em><span>${esc(ago(ms(a)))}</span><span data-eyebox>${eyeHTML(a.views || 0)}</span></div>
    <h2 class="a-title2">${esc(a.title)}</h2>
    ${a.text ? `<div class="a-text2">${fmtText(a.text)}</div>` : ""}`;
  if (!d.open) d.showModal();
  const u = new URL(location.href); u.searchParams.set("annonce", id); history.replaceState(null, "", u.pathname + u.search + u.hash);
}

export function initAnnonces() {
  const row = $("#annRow"); if (!row || !configured || !db) return;
  const act = e => { const c = e.target.closest(".annc"); if (c) openAnnonce(c.dataset.id); };
  row.addEventListener("click", act);
  row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e); } });
  try {
    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(8)), s => {
      list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      paint();
      const want = new URLSearchParams(location.search).get("annonce");
      if (want && !initAnnonces.done && list.some(a => a.id === want)) { initAnnonces.done = true; openAnnonce(want); }
    }, () => { /* hors connexion ou accès refusé : le bandeau reste simplement caché */ });
  } catch { /* idem */ }
}
