// SokoPlus : envoi des e-mails (gratuit, sans carte bancaire).
// À coller dans https://script.google.com (nouveau projet), puis Déployer > Nouveau déploiement > Application Web
// (Exécuter en tant que : moi / Accès : tout le monde). Copie l'adresse obtenue dans SITE.notifyUrl (js/firebase-config.js).

const ADMIN_EMAIL = "joshmukandirwa@gmail.com";
const API_KEY = "AIzaSyD1uI7s5-cnkL7sf3_2Xqwo5BxTGo3jEC0";   // la même apiKey que dans firebase-config.js
const SITE_URL = "https://sokoplus.store";   // adresse du site

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const who = verify_(d.idToken);          // on vérifie qui appelle, grâce à son jeton de connexion Firebase
    if (!who) return out_("refus");
    const title = clean_(d.title), shop = clean_(d.shopName);

    if (d.type === "new_submission") {
      MailApp.sendEmail(ADMIN_EMAIL, "SokoPlus : nouvel article à valider",
        shop + " vient d'envoyer « " + title + " ».\n\nOuvre la page admin pour le valider ou le refuser." + (SITE_URL ? "\n" + SITE_URL + "/admin.html" : ""));
    } else if ((d.type === "approved" || d.type === "rejected") && who.verified && who.email === ADMIN_EMAIL.toLowerCase()) {
      const to = clean_(d.to);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return out_("adresse");
      if (d.type === "approved") {
        MailApp.sendEmail(to, "SokoPlus : ton article est en ligne",
          "Bonne nouvelle " + shop + ", ton article « " + title + " » a été validé et il est maintenant visible par tout le monde sur SokoPlus.");
      } else {
        MailApp.sendEmail(to, "SokoPlus : ton article n'a pas été validé",
          "Bonjour " + shop + ", ton article « " + title + " » n'a pas été validé." + (d.reason ? "\n\nMotif : " + clean_(d.reason) : "") + "\n\nTu peux corriger et le renvoyer depuis ton espace vendeur.");
      }
    }
    return out_("ok");
  } catch (err) { return out_("erreur"); }
}

function verify_(idToken) {
  if (!idToken) return null;
  const r = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY, {
    method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) return null;
  const u = (JSON.parse(r.getContentText()).users || [])[0];
  return u ? { email: String(u.email || "").toLowerCase(), verified: !!u.emailVerified } : null;
}
const clean_ = s => String(s || "").replace(/[\r\n]+/g, " ").slice(0, 200);
const out_ = t => ContentService.createTextOutput(t);
