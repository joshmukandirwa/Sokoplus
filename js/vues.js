/* Compteur de vues : un petit œil et un nombre.
   - Une vue = un appareil, une seule fois (mémorisé sur l'appareil), pour que le chiffre reste honnête.
   - Articles : collection « itemViews » (lue seulement quand on ouvre la fiche, donc presque aucune lecture en plus).
   - Annonces : champ « views » de l'annonce elle-même (elles sont peu nombreuses). */
import { db, doc, getDoc, setDoc, updateDoc, increment } from "./fb.js";
import { configured } from "./util.js";
import { icon } from "./icons.js";

const KEY = "vw1";
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const remember = k => { try { localStorage.setItem(KEY, JSON.stringify([...seen(), k].slice(-500))); } catch { /* stockage indisponible : on compte quand même */ } };

export const fmtViews = n => { n = Math.max(0, Number(n) || 0); return n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1e4 ? Math.round(n / 1e3) + " k" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(".", ",") + " k" : String(n); };
export const eyeHTML = n => `<span class="eye" title="${Number(n) || 0} vue${n > 1 ? "s" : ""}">${icon("eye")}<b>${fmtViews(n)}</b></span>`;

/* kind : "i" (article) ou "a" (annonce). Renvoie true si une vue vient d'être ajoutée. */
export async function countView(kind, id) {
  const k = kind + ":" + id;
  if (!configured || !db || navigator.onLine === false || seen().has(k)) return false;
  remember(k);
  try {
    if (kind === "a") await updateDoc(doc(db, "announcements", id), { views: increment(1) });
    else await setDoc(doc(db, "itemViews", id), { n: increment(1) }, { merge: true });
    return true;
  } catch { return false; }
}
export async function viewsOf(id) {
  try { const s = await getDoc(doc(db, "itemViews", id)); return s.exists() ? Number(s.data().n) || 0 : 0; } catch { return 0; }
}
