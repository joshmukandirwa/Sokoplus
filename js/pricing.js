/* Tarif de l'abonnement : lu dans Firestore (config/pricing), modifiable depuis l'admin.
   Sans réglage enregistré, on garde le texte de firebase-config.js. */
import { db, doc, onSnapshot } from "./fb.js";
import { SITE } from "./common.js";

export let pricing = null;
export const fmt = (n, cur) => cur === "FC" ? `${Number(n).toLocaleString("fr-FR")} FC` : `${String(n).replace(".", ",")} $`;
const ends = p => p?.endsAt?.toMillis?.() ?? (typeof p?.endsAt === "number" ? p.endsAt : 0);
/* Le prix barré n'existe que s'il est plus haut que le prix actuel et que la promo n'est pas finie */
export const struck = p => !!(p && p.oldPrice && Number(p.oldPrice) > Number(p.price) && (!ends(p) || ends(p) > Date.now()));
export const pct = p => struck(p) ? Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 100) : 0;
export const priceText = p => p && p.price ? `${fmt(p.price, p.currency)} ${p.per || "par mois"}` : SITE.subscriptionText;
export const priceHtml = p => {
  if (!p || !p.price) return SITE.subscriptionText;
  const e = ends(p), until = struck(p) && e ? ` <small>jusqu'au ${new Date(e).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</small>` : "";
  return `${struck(p) ? `<s class="pr-old">${fmt(p.oldPrice, p.currency)}</s> ` : ""}<b class="pr-now">${fmt(p.price, p.currency)}</b> ${p.per || "par mois"}${struck(p) ? ` <em class="pr-off">−${pct(p)} %</em>` : ""}${until}`;
};
const subs = [];
export function watchPricing(cb) {
  subs.push(cb); cb(pricing);
  if (subs.length > 1 || !db) return;
  try { onSnapshot(doc(db, "config", "pricing"), s => { pricing = s.exists() ? s.data() : null; subs.forEach(f => f(pricing)); }, () => { /* hors connexion : tarif par défaut */ }); } catch { /* Firebase indisponible */ }
}
