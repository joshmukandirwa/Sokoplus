// S'abonner à une boutique : bouton [data-follow="ID"], compteur [data-followers="ID"], boutiques suivies.
// Les écritures passent par le serveur Vercel (api/follow.js) : aucun faux chiffre possible.
import { auth, db, onAuthStateChanged, collection, query, where, onSnapshot, doc, getDoc } from "./fb.js";
import { toast, pushAvailable, pushState } from "./util.js";

/* 999 -> 999 · 1000 -> 1k · 1250 -> 1,2k · 12 400 -> 12k · 1 250 000 -> 1,2M */
export function fmtCount(n) {
  n = Math.max(0, Math.floor(Number(n) || 0));
  const dec = (v, d) => { const x = Math.floor(v / d * 10) / 10; return String(x).replace(".", ","); };
  if (n < 1000) return String(n);
  if (n < 10000) return dec(n, 1000) + "k";
  if (n < 1e6) return Math.floor(n / 1000) + "k";
  return dec(n, 1e6) + "M";
}

let uid = null, mine = new Map(), offFollows = null;
const stats = new Map(), asked = new Set();
export const myFollows = () => [...mine.entries()].map(([id, v]) => ({ id, ...v }));
export const myFollowCount = () => mine.size;

function label(on) { return on ? "Abonné ✓" : "S'abonner"; }
let raf = 0;
export function paintFollow() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    document.querySelectorAll("[data-follow]").forEach(b => {
      const id = b.dataset.follow, on = mine.has(id), key = (on ? "1" : "0") + (uid === id ? "m" : "");
      if (b.dataset.fs === key) return;
      b.dataset.fs = key; b.hidden = uid === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = label(on);
    });
    document.querySelectorAll("[data-followers]").forEach(el => {
      const id = el.dataset.followers;
      if (stats.has(id)) { const t = fmtCount(stats.get(id)); if (el.textContent !== t) el.textContent = t; }
      else if (!asked.has(id) && db) { asked.add(id); getDoc(doc(db, "shopStats", id)).then(s => stats.set(id, s.exists() ? Number(s.data().followers) || 0 : 0)).catch(() => stats.set(id, 0)).finally(paintFollow); }
    });
  });
}
const emit = () => { paintFollow(); document.dispatchEvent(new CustomEvent("follows")); };

if (auth) onAuthStateChanged(auth, u => {
  uid = u ? u.uid : null; offFollows && offFollows(); offFollows = null; mine = new Map(); emit();
  if (!u) return;
  offFollows = onSnapshot(query(collection(db, "follows"), where("uid", "==", u.uid)), s => {
    mine = new Map(s.docs.map(d => [d.data().shopId, { shopName: d.data().shopName || "", logo: d.data().logo || "" }]));
    emit();
  }, () => { /* lecture impossible : on affiche « S'abonner » */ });
});

/* Nombre d'abonnés de MA boutique (tableau de bord vendeur), en direct */
export function watchMyFollowers(cb) {
  if (!auth) return;
  let off = null;
  onAuthStateChanged(auth, u => {
    off && off(); off = null; cb(0);
    if (u) off = onSnapshot(doc(db, "shopStats", u.uid), s => cb(s.exists() ? Number(s.data().followers) || 0 : 0), () => { });
  });
}

export async function toggleFollow(shopId, btn) {
  if (!auth) return toast("Connexion indisponible pour le moment.");
  if (!uid) { if (confirm("Connecte-toi pour t'abonner aux boutiques. Ouvrir la page de connexion ?")) location.href = "compte.html"; return; }
  const on = !mine.has(shopId);
  if (btn) btn.disabled = true;
  try {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch("/api/follow", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ shopId, on }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "Impossible pour le moment.");
    stats.set(shopId, j.followers);
    if (j.following) mine.set(shopId, mine.get(shopId) || { shopName: "", logo: "" }); else mine.delete(shopId);
    emit();
    toast(j.following ? "Abonné ✓" : "Désabonné", { ms: 1400 });
    if (j.following && pushAvailable() && !pushState() && typeof Notification !== "undefined" && Notification.permission === "default"
        && confirm("Activer les alertes pour être prévenu quand cette boutique publie ?")) {
      try { const { enablePush } = await import("./common.js"); await enablePush([]); toast("Alertes activées"); } catch (e) { toast(e.message || "Impossible d'activer les alertes."); }
    }
  } catch (e) {
    toast(e && e.message && e.message !== "Failed to fetch" ? e.message : "Impossible pour le moment. Vérifie ta connexion.");
  } finally { if (btn) btn.disabled = false; }
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-follow]"); if (!b) return;
  e.preventDefault(); e.stopPropagation(); toggleFollow(b.dataset.follow, b);
}, true);
new MutationObserver(paintFollow).observe(document.documentElement, { childList: true, subtree: true });
paintFollow();
