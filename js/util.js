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
/* Chaque article garde la monnaie choisie par le vendeur : "USD" (par défaut, anciens articles) ou "FC". */
export function money(amount, cur = "USD") {
  const n = Number(amount) || 0;
  if (cur === "FC") return Math.round(n).toLocaleString("fr-FR") + " FC";
  return Number(n.toFixed(2)).toLocaleString("fr-FR") + " $";
}

/* ---------- Téléphone : "0990 000 001", "+243 990 000 001" -> "243990000001" ---------- */
export function normPhone(raw) {
  const s = String(raw || "").trim();
  let d = s.replace(/\D/g, "");
  if (!s.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith("0")) d = "243" + d.slice(1);
    else if (d.length === 9) d = "243" + d;
  }
  return /^\d{10,15}$/.test(d) ? d : "";
}
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
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok || !j.secure_url) throw new Error(j.error?.message || "Échec de l'envoi de la photo.");
  return j.secure_url;
}

/* ---------- Notifications : état local (sans Firebase) ---------- */
export const pushAvailable = () => !!VAPID_KEY && "Notification" in window && "serviceWorker" in navigator;
export const pushState = () => store.get("push", null); // { token, cats }
