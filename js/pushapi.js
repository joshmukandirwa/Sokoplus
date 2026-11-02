// Demande au serveur Vercel (api/push.js) d'envoyer une notification push. Silencieux : si ça échoue, rien ne casse.
import { auth } from "./fb.js";

export async function pingPush(body) {
  try {
    const u = auth && auth.currentUser; if (!u) return;
    const token = await u.getIdToken();
    await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body), keepalive: true });
  } catch { /* pas de réseau ou serveur non configuré : l'app continue normalement */ }
}
