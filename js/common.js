import { firebaseConfig, VAPID_KEY } from "./firebase-config.js";
import { app, db, doc, setDoc, deleteDoc, serverTimestamp, ready } from "./fb.js";
import { store, configured, pushState } from "./util.js";
export * from "./util.js";

/* ---------- Notifications push (site fermé) ---------- */

export async function enablePush(cats) {
  if (!VAPID_KEY) throw new Error("Les notifications hors-ligne ne sont pas encore activées sur ce site.");
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Ce navigateur ne gère pas les notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Les notifications sont refusées dans les réglages du navigateur.");
  const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js?cfg=" + encodeURIComponent(JSON.stringify(firebaseConfig)));
  await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Impossible d'obtenir l'autorisation de notification.");
  await setDoc(doc(db, "pushTokens", token), { cats, updatedAt: serverTimestamp() });
  store.set("push", { token, cats });
}
export async function disablePush() {
  const p = pushState();
  if (p?.token) { try { await deleteDoc(doc(db, "pushTokens", p.token)); } catch { /* déjà supprimé */ } }
  store.set("push", null);
}

export function configBanner() {
  if (configured && app) return;
  const b = document.createElement("div");
  b.className = "cfgbanner";
  b.innerHTML = configured
    ? "Connexion à Firebase impossible pour le moment. Vérifie ta connexion internet."
    : "Mode démo : Firebase n'est pas encore configuré (voir <b>js/firebase-config.js</b> et le README).";
  document.body.prepend(b);
}
