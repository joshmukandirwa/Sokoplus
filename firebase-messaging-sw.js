// Reçoit les notifications push quand le site est fermé.
// La configuration Firebase arrive dans l'URL d'enregistrement (voir js/common.js), donc rien à modifier ici.
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

let cfg = {};
try { cfg = JSON.parse(new URL(self.location.href).searchParams.get("cfg") || "{}"); } catch (e) { cfg = {}; }

if (cfg.projectId) {
  firebase.initializeApp(cfg);
  firebase.messaging(); // les messages avec "notification" s'affichent automatiquement, le clic ouvre le lien de l'article
}
