/* Compte acheteur : un compte simple (prénom, email, mot de passe) pour noter les boutiques. Pas besoin d'avoir une boutique. */
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, doc, getDoc, setDoc, serverTimestamp
} from "./fb.js";
import { $, esc, isNetErr, NET_MSG, toast, unlinkPush } from "./common.js";
import { run, btnOf } from "./feedback.js";

const say = (el, text, kind = "") => { el.hidden = !text; el.className = "msg " + kind; el.textContent = text || ""; };
const nice = e => isNetErr(e) ? NET_MSG : ({
  "auth/email-already-in-use": "Tu as déjà un compte avec cet email. Connecte-toi, c'est plus simple.",
  "auth/invalid-credential": "On n'a pas reconnu ces infos. Vérifie ton email et ton mot de passe.",
  "auth/wrong-password": "On n'a pas reconnu ces infos. Vérifie ton email et ton mot de passe.",
  "auth/user-not-found": "On n'a pas reconnu ces infos. Vérifie ton email et ton mot de passe.",
  "auth/invalid-email": "Cette adresse email n'a pas l'air correcte. Vérifie-la.",
  "auth/weak-password": "Choisis un mot de passe un peu plus long (6 caractères au minimum).",
  "auth/too-many-requests": "Trop d'essais pour le moment. Réessaie dans quelques minutes.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé pour la connexion Google (Firebase : Authentication > Paramètres > Domaines autorisés).",
  "auth/operation-not-allowed": "La connexion Google n'est pas encore activée dans Firebase.",
  "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres pop-up et réessaie.",
  "permission-denied": "Cette action n'est pas possible pour le moment. Recharge la page et réessaie."
}[e.code] || e.message || "Oups, quelque chose n'a pas marché. Réessaie dans un instant.");

function tab(login) {
  $("#fLogin").hidden = !login; $("#fSignup").hidden = login;
  $("#tLogin").setAttribute("aria-selected", login); $("#tSignup").setAttribute("aria-selected", !login);
  say($("#authMsg"), "");
}
$("#tLogin").onclick = () => tab(true);
$("#tSignup").onclick = () => tab(false);

let signingUp = false;
const cleanName = s => String(s || "").trim().replace(/\s+/g, " ").slice(0, 40);

/* Crée la fiche acheteur si la personne n'a ni fiche acheteur ni boutique. Renvoie son nom affiché. */
async function ensure(u, wanted = "") {
  const shop = await getDoc(doc(db, "users", u.uid));
  const buyer = await getDoc(doc(db, "buyers", u.uid));
  if (buyer.exists()) return { name: buyer.data().name, shop: shop.exists() };
  const base = shop.exists() ? shop.data().shopName : wanted || u.displayName || (u.email || "").split("@")[0] || "Client";
  let name = cleanName(base); if (name.length < 2) name = "Client";
  await setDoc(doc(db, "buyers", u.uid), { name, createdAt: serverTimestamp() });
  return { name, shop: shop.exists() };
}

async function show(u) {
  if (!u) { $("#me").hidden = true; $("#auth").hidden = false; return; }
  $("#auth").hidden = true; $("#me").hidden = false;
  $("#meName").textContent = cleanName(u.displayName || (u.email || "").split("@")[0]); $("#meMail").textContent = u.email || "";
  try {
    const r = await ensure(u);
    $("#meName").textContent = r.name; $("#shopLink").hidden = !r.shop;
  } catch (err) { say($("#meMsg"), nice(err), "err"); }
}

if (!auth) { $("#noFb").hidden = false; }
else onAuthStateChanged(auth, u => { if (!signingUp) show(u); });

$("#fLogin").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#authMsg"); say(m, "On vérifie tes infos…");
  run(btnOf(e), () => signInWithEmailAndPassword(auth, $("#loginId").value.trim().toLowerCase(), $("#loginPw").value), { busy: "Connexion…", done: "Connecté" })
    .then(() => say(m, "")).catch(err => say(m, nice(err), "err"));
});
$("#fSignup").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#authMsg");
  run(btnOf(e), async () => {
    const name = cleanName($("#bName").value);
    if (name.length < 2) throw { message: "Écris ton prénom ou un pseudo (2 lettres minimum)." };
    say(m, "On crée ton compte…");
    signingUp = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, $("#bMail").value.trim().toLowerCase(), $("#bPw").value);
      await ensure(cred.user, name);
    } finally { signingUp = false; }
    show(auth.currentUser);
  }, { busy: "Création…", done: "Compte créé" }).then(() => say(m, "")).catch(err => say(m, nice(err), "err"));
});
$("#forgot").onclick = async () => {
  const m = $("#authMsg"), id = $("#loginId").value.trim();
  if (!id) return say(m, "Écris ton email dans le premier champ, puis touche « Mot de passe oublié ».", "warn");
  try {
    await run($("#forgot"), () => sendPasswordResetEmail(auth, id.toLowerCase()), { busy: "Envoi…", done: "Envoyé", hold: 900 });
    say(m, "C'est envoyé. Regarde ta boîte mail (et les spams) pour changer ton mot de passe.", "good");
  } catch (err) { say(m, nice(err), "err"); }
};
$("#gBtn").onclick = () => {
  const m = $("#authMsg"); say(m, "Ouverture de Google…");
  run($("#gBtn"), async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (err) {
      if (err.code === "auth/popup-blocked") { try { await signInWithRedirect(auth, new GoogleAuthProvider()); return; } catch (e2) { err = e2; } }
      throw err;
    }
  }, { hold: 500 }).then(() => say(m, "")).catch(err => {
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code)) return say(m, "");
    say(m, nice(err), "err");
  });
};
$("#logout").onclick = async () => {
  try { await unlinkPush().catch(() => { }); await signOut(auth); toast("Tu es déconnecté."); } catch (err) { say($("#meMsg"), nice(err), "err"); }
};
