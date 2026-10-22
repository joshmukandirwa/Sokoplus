// Envoie un e-mail via le script Google (apps-script/notify.gs). Bonus : si rien n'est configuré, on ne fait rien.
import { auth } from "./fb.js";
import { SITE } from "./util.js";

export async function notify(type, data = {}) {
  if (!SITE.notifyUrl || !auth || !auth.currentUser) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch(SITE.notifyUrl, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type, idToken, ...data })
    });
  } catch { /* l'e-mail est un plus : l'application continue sans */ }
}
