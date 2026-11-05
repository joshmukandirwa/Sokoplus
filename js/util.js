import { decimalsOf } from "./pays.js";
import { icon } from "./icons.js";
import { firebaseConfig, VAPID_KEY, CLOUDINARY, SITE } from "./firebase-config.js";

export { SITE };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const configured = !/COLLE_ICI/.test(firebaseConfig.apiKey || "COLLE_ICI");
export const cloudinaryReady = !/COLLE_ICI/.test(CLOUDINARY.cloudName);

/* Tout texte écrit par un utilisateur passe par esc() avant d'entrer dans le HTML. */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const safeUrl = u => (/^https:\/\//.test(u || "") ? u : "");

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};

/* ---------- Prix ---------- */
const SYM = { USD: "$", EUR: "€", FC: "FC", XOF: "F CFA", XAF: "F CFA" };
export function money(price, cur = "USD") {   // chaque article garde sa monnaie, aucune conversion
  const n = Number(price) || 0, d = decimalsOf(cur);
  return Number(n.toFixed(d)).toLocaleString("fr-FR", { maximumFractionDigits: d }) + " " + (SYM[cur] || cur);
}

/* ---------- Téléphone : "0993 582 704", "+243 990 123 456" -> "243990123456" ---------- */
// Indicatifs téléphoniques réellement attribués (1, 2 ou 3 chiffres) : un numéro qui commence par autre chose (ex. 899) est faux.
const CODES = new Set("1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 992 993 994 995 996 998".split(" "));
export const codeOf = d => [1, 2, 3].map(n => String(d).slice(0, n)).find(c => CODES.has(c)) || "";
export const hasRealCode = d => !!codeOf(d);
// Nombre de chiffres du numéro national (après l'indicatif) par pays : trop court ou trop long = numéro suspect. Pays absents : règle générale 10 à 15 chiffres au total.
const LEN = {"243": [9, 9], "250": [9, 9], "257": [8, 8], "256": [9, 9], "254": [9, 9], "255": [9, 9], "242": [9, 9], "244": [9, 9], "260": [9, 9], "263": [9, 10], "258": [9, 9], "265": [7, 9], "27": [9, 9], "264": [7, 9], "267": [7, 8], "268": [8, 8], "266": [8, 8], "261": [9, 9], "230": [7, 8], "248": [7, 7], "269": [7, 7], "251": [9, 9], "291": [7, 7], "253": [8, 8], "252": [7, 9], "211": [9, 9], "249": [9, 9], "20": [9, 10], "218": [9, 10], "216": [8, 8], "213": [8, 9], "212": [9, 9], "222": [8, 8], "221": [9, 9], "33": [9, 9], "32": [8, 9], "1": [10, 10], "44": [10, 10], "91": [10, 10], "86": [11, 11], "971": [9, 9], "234": [8, 10], "233": [9, 9], "225": [8, 10], "237": [8, 9], "241": [7, 8], "236": [8, 8], "235": [8, 8], "229": [8, 10], "228": [8, 8], "226": [8, 8], "223": [8, 8], "227": [8, 8], "224": [9, 9], "231": [7, 9], "232": [8, 8], "220": [7, 7], "245": [7, 9], "238": [7, 7], "239": [7, 7], "240": [9, 9], "49": [10, 12], "39": [9, 11], "34": [9, 9], "351": [9, 9], "41": [9, 9], "31": [9, 9], "90": [10, 10], "966": [9, 9], "961": [7, 8], "7": [10, 10]};
// Ancienne règle, large : sert seulement à retrouver un compte déjà créé (connexion, mot de passe oublié)
export function normPhoneLoose(raw) {
  const s = String(raw || "").trim();
  let d = s.replace(/\D/g, "");
  if (!s.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith("0")) d = "243" + d.slice(1);
    else if (d.length === 9) d = "243" + d;
  }
  return /^\d{10,15}$/.test(d) ? d : "";
}
// Règle stricte (inscription, changement de numéro) : indicatif existant, RDC = mobile 08x/09x (12 chiffres), pas de chiffres répétés
export function normPhone(raw) {
  const d = normPhoneLoose(raw);
  return d && phoneIssue(d) === "" ? d : "";
}
export function phoneIssue(d) {   // "" si le numéro (déjà normalisé) est plausible, sinon la raison
  if (!/^\d{10,15}$/.test(d)) return "format";
  if (!hasRealCode(d)) return "indicatif";
  if (d.startsWith("243") && !/^243[89]\d{8}$/.test(d)) return "rdc";
  const c = codeOf(d), r = LEN[c];
  if (r) { const n = d.length - c.length; if (n < r[0]) return "court"; if (n > r[1]) return "long"; }
  if (/(\d)\1{5,}/.test(d.slice(3))) return "repete";
  if (/0123456|1234567|2345678|3456789|9876543|8765432|7654321|6543210/.test(d.slice(3))) return "repete";
  return "";
}
// Confirmation WhatsApp du numéro : facultative (badge « Numéro confirmé » = bonus de confiance, plus aucun blocage de publication)
export const prettyPhone = p => "+" + String(p).replace(/^(\d{3})(\d{3})(\d{3})(\d*)$/, "$1 $2 $3 $4").trim();
export const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

/* ---------- Divers ---------- */
export function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}
export function tileColor(name) {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 38%)`;
}
/* Miniature légère via Cloudinary (économise la data sur mobile). */
export function thumb(url, w = 480) {
  const u = safeUrl(url);
  return u.includes("res.cloudinary.com") ? u.replace("/upload/", `/upload/w_${w},c_limit,q_auto,f_auto/`) : u;
}

/* ---------- Connexion internet ---------- */
export const NET_MSG = "Pas de connexion internet. Vérifie ton réseau puis réessaie.";
export const isOffline = () => navigator.onLine === false;
export const isNetErr = e => isOffline() || ["auth/network-request-failed", "unavailable", "deadline-exceeded"].includes(e?.code) || /network|failed to fetch|offline|load failed/i.test(e?.message || "");
export const failText = e => isNetErr(e) ? NET_MSG : (e?.code || e?.message || "erreur inconnue");
/* À appeler avant une action qui a besoin d'internet : prévient et renvoie false si la connexion est coupée. */
export function needNet(msg = NET_MSG) { if (!isOffline()) return true; toast(msg); return false; }

export function toast(msg, { onClick, ms = 6000 } = {}) {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("button");
  t.type = "button"; t.className = "toast"; t.textContent = msg;
  t.onclick = () => { t.remove(); onClick && onClick(); };
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

/* Réduit la photo avant envoi (900 px, JPEG) : rapide même avec une connexion lente. */
export function compress(file, max = 1000, q = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error("Image illisible"))), "image/jpeg", q);
    };
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = url;
  });
}

export async function uploadImage(blob) {
  if (!cloudinaryReady) throw new Error("Cloudinary n'est pas configuré (voir README, étape 5).");
  const fd = new FormData();
  fd.append("file", blob);
  fd.append("upload_preset", CLOUDINARY.uploadPreset);
  let r, j;
  try { r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, { method: "POST", body: fd }); j = await r.json(); }
  catch { throw Object.assign(new Error("La photo n'a pas pu partir : la connexion est coupée ou trop faible. Réessaie quand le réseau revient."), { code: "auth/network-request-failed" }); }
  if (!r.ok || !j.secure_url) throw new Error(j.error?.message || "Échec de l'envoi de la photo.");
  return j.secure_url;
}

/* ---------- Notifications : état local (sans Firebase) ---------- */
export const pushAvailable = () => !!VAPID_KEY && "Notification" in window && "serviceWorker" in navigator;
export const pushState = () => store.get("push", null); // { token, cats }


/* ---------- Profil public de la boutique : liens, coordonnées, couverture ---------- */
/* Accepte un lien complet, un nom de domaine, ou (si base est donné) un simple nom d'utilisateur. Renvoie "" si vide, null si invalide. */
export function normLink(v, base = "") {
  v = String(v || "").trim(); if (!v) return "";
  if (/^https?:\/\//i.test(v)) v = v.replace(/^http:\/\//i, "https://");
  else if (base && /^@?[\w.\-]+$/.test(v)) v = base + v.replace(/^@/, "");
  else if (/^[\w\-]+(\.[\w\-]+)+(\/\S*)?$/.test(v)) v = "https://" + v;
  else return null;
  return v.length <= 200 && !/\s/.test(v) ? v : null;
}
const niceLink = u => u.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");
/* Lignes de coordonnées (adresse, email, liens) : tout est échappé, les liens doivent être en https */
export function shopInfoHtml(x = {}, phone = "") {
  const row = (ic, inner) => `<li>${icon(ic)}<span>${inner}</span></li>`;
  const a = (u, label) => safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : "";
  const out = [];
  if (phone) out.push(row("phoneCall", esc(prettyPhone(phone))));
  if (x.address) out.push(row("pin", esc(x.address)));
  if (x.email) out.push(row("mail", `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>`));
  if (x.website && safeUrl(x.website)) out.push(row("globe", a(x.website, niceLink(x.website))));
  if (x.facebook && safeUrl(x.facebook)) out.push(row("link", a(x.facebook, "Facebook")));
  if (x.instagram && safeUrl(x.instagram)) out.push(row("link", a(x.instagram, "Instagram")));
  return out.join("");
}
export const coverCss = (url, name = "") => safeUrl(url)
  ? `background-image:url(${esc(thumb(url, 900))})`
  : `background-image:linear-gradient(120deg, ${tileColor(name)}, #ff6a00)`;
