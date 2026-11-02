import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp, Timestamp, getDocs
} from "./fb.js";
import { bindLogout } from "./logout.js";
import {
  SITE, store, configured, configBanner, $, $$, esc, safeUrl, money, normPhone, prettyPhone, waLink,
  compress, uploadImage, thumb, tileColor, toast, ago, isNetErr, NET_MSG, needNet, normLink, shopInfoHtml, coverCss,
  pushAvailable, pushState, enablePush, unlinkPush
} from "./common.js";
import { injectIcons, icon } from "./icons.js";
import { notify } from "./notify.js";
import { pingPush } from "./pushapi.js";
import { onMyNotifs, myNotifs, unread, markRead, removeNotifs, ms as nms } from "./mesnotifs.js";
import { COUNTRIES, DEFAULT_COUNTRY, citiesOf, currenciesOf, curName, ALL_CURRENCIES, decimalsOf } from "./pays.js";
import { run, btnOf } from "./feedback.js";

configBanner();
$("#subTxt").textContent = SITE.subscriptionText;
$("#iCat").innerHTML = SITE.categories.map(c => `<option>${esc(c)}</option>`).join("");
$("#iCountry").innerHTML = COUNTRIES.map(c => `<option value="${c[0]}">${esc(c[1])}</option>`).join("");
function fillPlace(country, city, cur) {   // villes et monnaies du pays choisi
  $("#iCountry").value = country;
  $("#iCity").innerHTML = '<option value="">Choisis ta ville</option>' + citiesOf(country).map(c => `<option>${esc(c)}</option>`).join("");
  if (city) $("#iCity").value = city;
  $("#iCur").innerHTML = currenciesOf(country).map(c => `<option value="${c}">${esc(curName(c))}</option>`).join("");
  if (cur) $("#iCur").value = cur;
}
fillPlace(DEFAULT_COUNTRY);
$("#iCountry").addEventListener("change", e => fillPlace(e.target.value));

let user = null, pending = null, profile = null, editing = null, unsub = null, signingUp = false;
const DAY = 864e5;
const fakeMail = phone => `${phone}@tel.sokoplus.app`;            // compte créé avec le téléphone seul : adresse technique, pas une vraie boîte mail
const isFake = m => /@tel\.sokoplus\.app$/i.test(m || "");

const say = (el, text, kind = "") => { el.hidden = !text; el.className = "msg " + kind; el.textContent = text || ""; };
const nice = e => isNetErr(e) ? NET_MSG : ({
  "auth/email-already-in-use": "Tu as déjà un compte avec cet email. Connecte-toi, c'est plus simple.",
  "auth/invalid-credential": "On n'a pas reconnu ces infos. Vérifie ton email (ou ton numéro) et ton mot de passe.",
  "auth/wrong-password": "On n'a pas reconnu ces infos. Vérifie ton email (ou ton numéro) et ton mot de passe.",
  "auth/user-not-found": "On n'a pas reconnu ces infos. Vérifie ton email (ou ton numéro) et ton mot de passe.",
  "auth/invalid-email": "Cette adresse email n'a pas l'air correcte. Vérifie-la.",
  "auth/weak-password": "Choisis un mot de passe un peu plus long (6 caractères au minimum).",
  "auth/too-many-requests": "Trop d'essais pour le moment. Respire un instant et réessaie dans quelques minutes.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé pour la connexion Google (Authentication > Paramètres > Domaines autorisés).",
  "auth/operation-not-allowed": "La connexion Google n'est pas encore activée dans Firebase.",
  "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres pop-up et réessaie.",
  "auth/network-request-failed": "Pas de connexion internet. Vérifie ton réseau et réessaie.",
  "permission-denied": "Cette action n'est pas possible pour le moment. Vérifie que ton compte est actif, puis recharge la page."
}[e.code] || e.message || "Oups, quelque chose n'a pas marché. Réessaie dans un instant.");

$("#pwToggle").onclick = e => { const i = $("#pw"), show = i.type === "password"; i.type = show ? "text" : "password"; e.currentTarget.textContent = show ? "Masquer" : "Afficher"; };

/* ---------------- Onglets ---------------- */
function tab(login) {
  $("#fLogin").hidden = !login; $("#fSignup").hidden = login;
  $("#tLogin").setAttribute("aria-selected", login); $("#tSignup").setAttribute("aria-selected", !login);
  say($("#authMsg"), "");
}
$("#tLogin").onclick = () => tab(true);
$("#tSignup").onclick = () => tab(false);

/* ---------------- Connexion (email OU téléphone) ---------------- */
$("#fLogin").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#authMsg"); say(m, "On vérifie tes infos…");
  run(btnOf(e), async () => {
    welcome = true;
    let id = $("#loginId").value.trim();
    if (!id.includes("@")) {
      const p = normPhone(id);
      if (!p) throw { message: "Numéro invalide. Exemple : 0990 000 001" };
      const snap = await getDoc(doc(db, "phoneIndex", p));
      if (!snap.exists()) throw { code: "auth/invalid-credential" };
      id = snap.data().email;
    }
    await signInWithEmailAndPassword(auth, id.toLowerCase(), $("#loginPw").value);
  }, { busy: "Connexion…", done: "Connecté" }).then(() => say(m, "")).catch(err => { welcome = false; say(m, nice(err), "err"); });
});
$("#forgot").onclick = async () => {
  const m = $("#authMsg"); let id = $("#loginId").value.trim();
  if (!id) return say(m, "Écris ton email ou ton numéro dans le premier champ, puis touche « Mot de passe oublié ».", "warn");
  const wa = `<a href="${esc(waLink(SITE.adminWhatsapp, "Bonjour SokoPlus, j'ai oublié le mot de passe de ma boutique (" + id + ")."))}" target="_blank" rel="noopener">Écris-nous sur WhatsApp</a>`;
  try {
    if (!id.includes("@")) {
      const p = normPhone(id); if (!p) return say(m, "Numéro invalide. Exemple : 0990 000 001", "warn");
      const snap = await getDoc(doc(db, "phoneIndex", p));
      if (!snap.exists()) return say(m, "On ne trouve pas de boutique avec ce numéro.", "err");
      id = snap.data().email;
      if (isFake(id)) { m.hidden = false; m.className = "msg warn"; m.innerHTML = `Ton compte n'a pas d'email. ${wa} et on t'aide à récupérer ta boutique.`; return; }
    }
    await run($("#forgot"), () => sendPasswordResetEmail(auth, id.toLowerCase()), { busy: "Envoi…", done: "Envoyé", hold: 900 });
    say(m, "C'est envoyé. Regarde ta boîte mail (et les spams) pour changer ton mot de passe.", "good");
  } catch (err) { say(m, nice(err), "err"); }
};

/* ---------------- Continuer avec Google ---------------- */
$("#gBtn").onclick = () => {
  const m = $("#authMsg"); say(m, "Ouverture de Google…");
  run($("#gBtn"), async () => {
    welcome = true;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (err) {
      if (err.code === "auth/popup-blocked") { try { await signInWithRedirect(auth, new GoogleAuthProvider()); return; } catch (e2) { err = e2; } }
      throw err;
    }
  }, { hold: 500 }).then(() => say(m, "")).catch(err => {
    welcome = false;
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code)) return say(m, "");
    say(m, nice(err), "err");
  });
};
$("#fComplete").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#cMsg");
  run(btnOf(e), async () => {
    const shopName = $("#cShop").value.trim(), phone = normPhone($("#cPhone").value), email = (pending.email || "").toLowerCase();
    if (!phone) throw { message: "Numéro de téléphone invalide. Exemple : 0990 000 001" };
    say(m, "On prépare ta boutique…");
    if ((await getDoc(doc(db, "phoneIndex", phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une boutique." };
    await setDoc(doc(db, "users", pending.uid), { shopName, phone, email, status: "active", plan: "essai", activeUntil: Timestamp.fromMillis(Date.now() + 30 * DAY), createdAt: serverTimestamp() });
    await setDoc(doc(db, "phoneIndex", phone), { uid: pending.uid, email });
    await enter(pending);
  }, { busy: "Création…", done: "Boutique créée" }).then(() => say(m, "")).catch(err => say(m, nice(err), "err"));
});
$("#cCancel").onclick = () => signOut(auth);

/* ---------------- Inscription ---------------- */
$("#fSignup").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#authMsg");
  run(btnOf(e), async () => {
    welcome = true;
    const shopName = $("#shopName").value.trim(), phone = normPhone($("#phone").value);
    if (!phone) throw { message: "Numéro de téléphone invalide. Exemple : 0990 000 001" };
    const email = $("#email").value.trim().toLowerCase() || fakeMail(phone);
    say(m, "On prépare ta boutique…");
    if ((await getDoc(doc(db, "phoneIndex", phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une boutique." };
    signingUp = true;
    const cred = await createUserWithEmailAndPassword(auth, email, $("#pw").value);
    await setDoc(doc(db, "users", cred.user.uid), {
      shopName, phone, email, status: "active", plan: "essai",
      activeUntil: Timestamp.fromMillis(Date.now() + 30 * DAY),
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "phoneIndex", phone), { uid: cred.user.uid, email });
    if (!isFake(email)) { try { await sendEmailVerification(cred.user); } catch { /* il pourra le renvoyer */ } }
    signingUp = false;
    await enter(cred.user);
  }, { busy: "Création…", done: "Boutique créée" }).then(() => say(m, "")).catch(err => { signingUp = false; welcome = false; say(m, nice(err), "err"); });
});

/* ---------------- Session ---------------- */
if (!configured) { $("#auth").hidden = false; hashTab(); say($("#authMsg"), "Firebase n'est pas configuré : la connexion ne fonctionnera qu'après le README.", "warn"); }
else onAuthStateChanged(auth, async u => { if (signingUp) return; u ? await enter(u) : leave(); });

function hashTab() {
  const h = location.hash;
  if (h === "#inscription") tab(false); else if (h === "#connexion" || h === "#publier") tab(true);
  $("#gateMsg").hidden = h !== "#publier";
}
function leave() {
  hashTab();
  user = null; profile = null; unsub && unsub(); unsub = null;
  store.set("me", null);
  $("#dash").hidden = true; $("#complete").hidden = true; $("#auth").hidden = false; $("#logout").hidden = true;
}
bindLogout($("#logout"), async () => { await unlinkPush().catch(() => { }); return signOut(auth); }, () => ($("#dShop")?.textContent || "").trim());
addEventListener("hashchange", hashTab);   // les boutons « J'ai déjà un compte » / « Créer ma boutique » de la fenêtre Vendre

let welcome = false;
async function enter(u) {
  user = u;
  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) {
    if (u.providerData.some(p => p.providerId === "google.com")) {   // première connexion Google : il faut finir la boutique
      pending = u; $("#auth").hidden = true; $("#dash").hidden = true; $("#complete").hidden = false; $("#logout").hidden = false;
      $("#cMail").textContent = u.email || ""; if (!$("#cShop").value) $("#cShop").value = u.displayName || "";
      return;
    }
    $("#complete").hidden = true; $("#dash").hidden = true; $("#auth").hidden = false; $("#logout").hidden = false;   // pas de déconnexion automatique
    say($("#authMsg"), `Le compte ${u.email || ""} n'a pas de boutique. Crée ta boutique, ou touche « Déconnexion » pour changer de compte.`, "warn"); return;
  }
  profile = snap.data();
  if (welcome) { welcome = false; toast(`Bienvenue ${profile.shopName}, content de te voir.`); }
  $("#complete").hidden = true; $("#auth").hidden = true; $("#dash").hidden = false; $("#logout").hidden = false;
  renderStatus();
  watchMine();
  if (location.hash === "#publier") setTimeout(() => $("#fItem").scrollIntoView({ behavior: "smooth" }), 150);
}

const MAX_MB = 4;                                   // poids maximum d'une photo
const isTrial = () => (profile.plan || "essai") === "essai";
const dayKey = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");   // jour en RDC (UTC+2)
const usedToday = () => waiting.filter(x => x.id.startsWith(`${user.uid}_${dayKey()}_`)).length;
const quotaText = () => `${profile.shopName}, tu as déjà publié tes 2 articles d'aujourd'hui avec l'essai gratuit. Reviens demain pour en publier d'autres, ou passe à la version complète pour publier sans limite.`;
function fmtLeft(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1e3);
  return (d ? `${d} j ` : "") + (d || h ? `${h} h ` : "") + `${m} min ${s} s`;
}

function state() {
  if (!profile) return { ok: false };
  const shop = profile.shopName, trial = isTrial();
  if (profile.status === "blocked") return { ok: false, label: "Compte suspendu", kind: "bad", why: `${shop}, ton compte est suspendu pour le moment. Écris-nous sur WhatsApp, on t'explique et on règle ça ensemble.`, wa: "Mon compte est suspendu, pouvez-vous m'aider ?" };
  const ms = profile.activeUntil.toMillis() - Date.now();
  if (ms <= 0) return { ok: false, label: trial ? "Essai terminé" : "Abonnement terminé", kind: "bad",
    why: trial ? `${shop}, ton essai gratuit de 30 jours est terminé. Passe à la version complète pour continuer à publier et vendre sans limite (${SITE.subscriptionText}).`
               : `${shop}, ton abonnement est arrivé à échéance. Renouvelle-le pour continuer à publier (${SITE.subscriptionText}).`,
    wa: trial ? "Je voudrais passer à la version complète de SokoPlus." : "Je voudrais renouveler mon abonnement SokoPlus.",
    cta: trial ? "Passer à la version complète sur WhatsApp" : "Renouveler sur WhatsApp" };
  return { ok: true, label: `${trial ? "Essai" : "Abonnement"} · ${fmtLeft(ms)}`, kind: ms <= 5 * DAY ? "warn" : "ok" };
}

const CERT_BADGE = '<img class="ic cert-ic" src="icons/certifie.png" width="16" height="16" alt="Boutique certifiée" title="Boutique certifiée SokoPlus" draggable="false">';

/* ---------------- Certification SokoPlus : guide, demande et messages de SokoPlus ---------------- */
/* Invitation à activer les alertes (même app fermée) pour les vendeurs connectés */
function renderPushAsk() {
  let el = $("#pushAsk");
  const ok = pushAvailable() && !pushState() && typeof Notification !== "undefined" && Notification.permission !== "denied" && Date.now() > (store.get("pushLater", 0) || 0);
  if (!ok) { if (el) el.remove(); return; }
  if (el || !$("#certBox")) return;
  el = document.createElement("section"); el.id = "pushAsk"; el.className = "pushask";
  el.innerHTML = '<div><b>Reçois les alertes SokoPlus</b><span>Certification, articles validés… même quand l\'app est fermée.</span></div><div class="pa"><button class="btn small" id="paYes" type="button">Activer</button><button class="btn small ghost" id="paNo" type="button">Plus tard</button></div>';
  $("#certBox").before(el);
  $("#paYes").onclick = async () => { try { await enablePush([]); toast("Alertes activées"); } catch (e) { toast(e.message || "Impossible d'activer les alertes."); } renderPushAsk(); };
  $("#paNo").onclick = () => { store.set("pushLater", Date.now() + 7 * 864e5); renderPushAsk(); };
}
function renderCert() {
  const b = $("#certBox"); if (!b || !profile) return;
  renderPushAsk();
  b.hidden = false;
  const msgs = myNotifs().slice(0, 3), nu = unread().length;
  const inbox = msgs.length ? `<div class="cmsgs"><h3>Messages de SokoPlus${nu ? ` <em>${nu} nouveau${nu > 1 ? "x" : ""}</em>` : ""}</h3>${msgs.map(n => `<div class="cmsg ${n.kind === "cert_rejected" ? "bad" : "ok"}${n.read ? "" : " new"}"><b>${esc(n.title || "Message de SokoPlus")}</b><span>${esc(n.text || "")}</span><small>${ago(nms(n))}</small><button class="cdel" type="button" data-del="${esc(n.id)}" aria-label="Supprimer ce message">✕</button></div>`).join("")}<div class="cacts">${nu ? '<button class="btn small ghost" type="button" id="cRead">Marquer comme lu</button>' : ""}<button class="btn small ghost cdelall" type="button" id="cDelAll">Tout supprimer</button></div></div>` : "";
  let body;
  if (profile.certified) {
    body = `<div class="cstate ok"><b>Ta boutique est certifiée SokoPlus.</b> Le badge s'affiche à côté de son nom, et tes nouveaux articles sont publiés tout de suite.</div>`;
  } else {
    const st = creq?.status;
    const guide = `<details class="cguide"${st ? "" : " open"}><summary>Comment ça marche</summary>
      <div class="cg"><h4>C'est quoi ?</h4><p>Un badge bleu à côté du nom de ta boutique, accordé par SokoPlus après vérification.</p>
      <h4>Pourquoi le demander ?</h4><p>Les acheteurs te font plus confiance, donc ils te contactent plus facilement.</p>
      <h4>Comment ça se passe ?</h4><ol><li>Tu cliques sur « Demander la certification ».</li><li>SokoPlus vérifie ta boutique : nom, numéro WhatsApp, articles et avis.</li><li>Tu reçois la réponse ici et dans la cloche de notifications.</li></ol>
      <h4>Ce que tu gagnes</h4><ul><li>Le badge sur ta boutique et sur tous tes articles</li><li>Ta boutique dans la rangée « boutiques certifiées » de l'accueil</li><li>Tes articles publiés sans attendre de validation</li></ul>
      <p class="note">Conseil : une photo de profil et quelques articles bien décrits aident beaucoup.</p></div></details>`;
    let state;
    if (st === "pending") state = `<div class="cstate warn"><b>Demande envoyée.</b> SokoPlus la vérifie. Réponse généralement sous 24 à 48 h.${creq.createdAt?.toMillis ? ` Envoyée ${esc(ago(creq.createdAt.toMillis()))}.` : ""}</div><button class="btn" type="button" disabled>Demande en attente</button>`;
    else if (st === "rejected") state = `<div class="cstate bad"><b>Ta demande n'a pas été acceptée pour le moment.</b>${creq.reason ? ` Motif : ${esc(creq.reason)}.` : ""} Tu peux corriger puis refaire une demande.</div><button class="btn" type="button" id="cAsk">Refaire une demande</button>`;
    else state = `<p class="note">Réponse généralement sous 24 à 48 h.</p><button class="btn" type="button" id="cAsk"${creqSeen ? "" : " disabled"}>Demander la certification</button>`;
    body = guide + state;
  }
  b.innerHTML = `<h2>Certification SokoPlus</h2>${body}${inbox}`;
  const ask = $("#cAsk"); if (ask) ask.onclick = () => askCert(ask);
  const rd = $("#cRead"); if (rd) rd.onclick = () => markRead(unread().map(n => n.id));
  $$("#certBox [data-del]").forEach(x => x.onclick = async () => {
    if (!confirm("Supprimer ce message ?")) return;
    const ok = (await removeNotifs([x.dataset.del]))[0]; toast(ok ? "Message supprimé" : "Suppression impossible, réessaie.", { ms: 1600 });
  });
  const da = $("#cDelAll"); if (da) da.onclick = async () => {
    const n = myNotifs().length; if (!n || !confirm(n > 1 ? `Supprimer les ${n} messages de SokoPlus ?` : "Supprimer ce message ?")) return;
    const r = await removeNotifs(myNotifs().map(m => m.id)); toast(r.every(Boolean) ? "Messages supprimés" : "Certains messages n'ont pas pu être supprimés.", { ms: 1800 });
  };
}
async function askCert(btn) {
  if (!needNet("Pas de connexion : tu ne peux pas envoyer ta demande pour l'instant.")) return;
  try {
    await run(btn, async () => {
      if (creq?.status === "rejected") await deleteDoc(doc(db, "certRequests", user.uid));
      await setDoc(doc(db, "certRequests", user.uid), { status: "pending", createdAt: serverTimestamp() });
    }, { busy: "Envoi…", done: "Envoyée", hold: 700 });
    notify("new_submission", { title: "Demande de certification", shopName: profile.shopName });
    toast("Demande envoyée. SokoPlus te répond sous 24 à 48 h.");
  } catch (err) { toast(nice(err)); }
}

/* Carte de la boutique (couverture, à propos, coordonnées) : même rendu que ce que voient les acheteurs */
let pub = {};
function paintCard() {
  $("#dCover").style.cssText = coverCss(pub.cover, profile.shopName);
  $("#seeShop").href = `recherche.html?shop=${encodeURIComponent(user.uid)}`;
  const about = $("#dAbout"), info = $("#dInfo");
  /* Le conseil « Ajoute une photo de couverture… » ne s'affiche que si la boutique est encore vide */
  const filled = !!(pub.cover || pub.about || pub.address || pub.email || pub.website || pub.facebook || pub.instagram);
  about.classList.toggle("empty", !pub.about);
  about.textContent = pub.about || (filled ? "" : "Ajoute une photo de couverture, une présentation et tes coordonnées : les acheteurs te font plus confiance.");
  about.hidden = !about.textContent;
  info.innerHTML = shopInfoHtml(pub, profile.phone); info.hidden = !info.innerHTML;
}
function renderStatus() {
  store.set("me", { n: profile.shopName || "", l: profile.logo || "" });   // la barre du bas affiche ta photo sur toutes les pages
  const s = state();
  const hr = new Date().getHours();
  $("#dHello").textContent = `${hr < 12 ? "Bonjour" : hr < 18 ? "Bon après-midi" : "Bonsoir"}, content de te revoir.`;
  $("#dShop").innerHTML = esc(profile.shopName) + (profile.certified ? CERT_BADGE : "");   // la certification s'affiche juste après le nom
  const av = $("#dAvatar"); av.style.background = tileColor(profile.shopName);
  av.innerHTML = profile.logo ? `<img src="${esc(thumb(profile.logo, 160))}" alt="">` : esc((profile.shopName || "?")[0].toUpperCase());
  paintCard();
  const pill = $("#dStatus"); pill.textContent = s.label || ""; pill.className = "pill " + (s.kind || "");
  renderCert();
  $("#verifyBox").hidden = user.emailVerified || isFake(profile.email); $("#verifyMail").textContent = profile.email;
  const bb = $("#blockBox");
  bb.hidden = !s.why;
  if (s.why) bb.innerHTML = `${esc(s.why)} <a href="${esc(waLink(SITE.adminWhatsapp, `Bonjour SokoPlus, je suis ${profile.shopName} (${prettyPhone(profile.phone)}). ${s.wa || "Je voudrais activer mon abonnement."}`))}" target="_blank" rel="noopener">${s.cta || "Écrire sur WhatsApp"}</a>`;
  lastDay = dayKey();
  const trial = isTrial(), used = usedToday(), full = trial && used >= 2 && !s.why, qb = $("#quotaBox");
  qb.hidden = !(trial && !s.why);
  if (!qb.hidden) {
    const left = Math.max(0, 2 - used);
    qb.className = "qbox " + (full ? "full" : "open");
    const C = 163.4, pct = left / 2;
    const cta = full ? `<a class="btn small qcta" href="${esc(waLink(SITE.adminWhatsapp, `Bonjour SokoPlus, je suis ${profile.shopName} (${prettyPhone(profile.phone)}). Je voudrais passer à la version complète de SokoPlus.`))}" target="_blank" rel="noopener">Passer à la version complète</a>` : "";
    qb.innerHTML = `<div class="qtop">
        <div class="qring" aria-hidden="true"><svg viewBox="0 0 64 64"><circle class="qr-bg" cx="32" cy="32" r="26"/><circle class="qr-fg" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 32 32)"/></svg><b>${left}<small>/2</small></b></div>
        <div class="qtx"><span class="qtag">Essai gratuit · limite du jour</span>
          <b>${full ? "Tes 2 publications du jour sont utilisées" : `Encore ${left} publication${left > 1 ? "s" : ""} aujourd'hui`}</b></div></div>
      <div class="qseg" role="img" aria-label="${used} publication${used > 1 ? "s" : ""} utilisée${used > 1 ? "s" : ""} sur 2">${[0, 1].map(n => `<i class="${n < used ? "on" : ""}"></i>`).join("")}</div>
      <div class="qfoot"><span class="qchip">${icon("clock")}${full ? "Reprise dans" : "Remise à zéro dans"} <span class="qcd" data-reset></span></span></div>
      ${full ? `<p class="qnote">${esc(profile.shopName)}, ta prochaine publication gratuite s'ouvre à minuit. Pour publier sans limite, passe à la version complète.</p>` : ""}${cta}`;
    tickReset();
  }
  $("#wiz").hidden = (!s.ok || full) && !editing;
  $("#iSubmit").disabled = (!s.ok && !editing) || (full && !editing);
}
/* Compte à rebours jusqu'à minuit (heure de RDC) : la limite du jour repart à zéro */
let lastDay = "";
const untilReset = () => { const n = Date.now() + 2 * 3600e3, d = new Date(n); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - n; };
function tickReset() {
  const ms = untilReset(), t = `${Math.floor(ms / 3600e3)} h ${String(Math.floor(ms % 3600e3 / 60e3)).padStart(2, "0")} min ${String(Math.floor(ms % 60e3 / 1e3)).padStart(2, "0")} s`;
  $$("[data-reset]").forEach(el => { el.textContent = t; });
}
/* Compte à rebours : le temps restant défile en direct */
setInterval(() => {
  if (!profile || !user || $("#dash").hidden) return;
  tickReset();
  if (lastDay && lastDay !== dayKey()) renderStatus();   // minuit passé : les 2 publications sont de nouveau disponibles
  const s = state(), pill = $("#dStatus");
  if (pill.textContent === s.label) return;
  pill.textContent = s.label; pill.className = "pill " + (s.kind || "");
  if (s.why) renderStatus();
}, 1000);
$("#resend").onclick = async () => { if (!needNet()) return; try { await sendEmailVerification(user); toast("Lien renvoyé. Regarde aussi dans les spams."); } catch (e) { toast(nice(e)); } };
$("#refresh").onclick = async () => { if (!needNet()) return; try { await user.reload(); await user.getIdToken(true); renderStatus(); if (!user.emailVerified) toast("Email pas encore vérifié."); } catch (e) { toast(nice(e)); } };

/* ---------------- Formulaire article ---------------- */
$("#iImgs").addEventListener("change", e => {
  const files = [...e.target.files].slice(0, 3);
  const big = files.find(f => f.size > MAX_MB * 1048576);
  if (big) { e.target.value = ""; $("#previews").innerHTML = ""; return toast(`La photo « ${big.name} » est trop lourde (${(big.size / 1048576).toFixed(1).replace(".", ",")} Mo). Maximum ${MAX_MB} Mo par photo.`); }
  $("#previews").innerHTML = "";
  files.forEach(f => { const i = new Image(); i.src = URL.createObjectURL(f); i.alt = ""; $("#previews").append(i); });
});

function resetForm() {
  editing = null; $("#fItem").reset(); $("#previews").innerHTML = "";
  $("#fTitle").textContent = "Publier un article"; $("#iSubmit").textContent = "Publier"; $("#iCancel").hidden = true;
  fillPlace(DEFAULT_COUNTRY); showStep(1); renderStatus();
}
$("#iCancel").onclick = resetForm;

/* ---------- Publication guidée, étape par étape ---------- */
const STEPS = 4; let step = 1;
const stepEl = n => document.querySelector(`.step[data-step="${n}"]`);
function validStep(n) {
  const ok = [...stepEl(n).querySelectorAll("input,select,textarea")].every(el => el.type === "file" || el.reportValidity());
  if (!ok) return false;
  if (n === 3 && !editing && !$("#iImgs").files.length) { say($("#iMsg"), "Ajoute au moins une photo pour continuer.", "err"); return false; }
  say($("#iMsg"), "");
  return true;
}
function showStep(n, scroll = true) {
  step = Math.max(1, Math.min(STEPS, n));
  for (let i = 1; i <= STEPS; i++) stepEl(i).hidden = i !== step;
  $$("#steps li").forEach(li => {
    const i = Number(li.dataset.s); li.className = i < step ? "done" : i === step ? "now" : "";
    if (i === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
  $("#stepFill").style.width = `${(step - 1) / (STEPS - 1) * 100}%`;
  $("#iBack").hidden = step === 1; $("#iNext").hidden = step === STEPS; $("#iSubmit").hidden = step !== STEPS;
  if (step === STEPS) recap();
  if (scroll) $("#fItem").scrollIntoView({ behavior: "smooth", block: "start" });
}
function recap() {
  const cur = ALL_CURRENCIES.includes($("#iCur").value) ? $("#iCur").value : "USD", price = Number($("#iPrice").value), desc = $("#iDesc").value.trim();
  const after = isTrial() && !editing ? Math.max(0, 1 - usedToday()) : null;   // publications restantes après cet envoi
  $("#recap").innerHTML = `<div class="rprev">${$("#previews").innerHTML}</div>
    <h3>${esc($("#iTitle").value.trim())}</h3>
    <div class="rprice">${money(price, cur)}</div>
    <dl class="rlist"><div><dt>Catégorie</dt><dd>${esc($("#iCat").value)}</dd></div>
      <div><dt>Lieu</dt><dd>${esc($("#iCity").value)}, ${esc($("#iAddr").value.trim())}</dd></div>
      ${desc ? `<div><dt>Description</dt><dd>${esc(desc)}</dd></div>` : ""}</dl>
    <p class="note">${editing ? "SokoPlus vérifie tes modifications avant de les mettre en ligne."
      : profile.certified ? "Boutique certifiée : ton article sera en ligne tout de suite."
      : `SokoPlus vérifie ton article avant de le mettre en ligne, puis te prévient.${after === null ? "" : ` Après cet envoi, il te restera ${after} publication${after > 1 ? "s" : ""} aujourd'hui.`}`}</p>`;
}
$("#iNext").onclick = () => { if (validStep(step)) showStep(step + 1); };
$("#iBack").onclick = () => showStep(step - 1);
showStep(1, false);

$("#fItem").addEventListener("submit", e => {
  e.preventDefault();
  if (step < STEPS) { if (validStep(step)) showStep(step + 1); return; }   // la touche Entrée = « Continuer »
  for (let i = 1; i < STEPS; i++) if (!validStep(i)) { showStep(i); setTimeout(() => validStep(i), 50); return; }
  const m = $("#iMsg"), btn = $("#iSubmit");
  run(btn, async () => {
    const files = [...$("#iImgs").files].slice(0, 3);
    if (!editing && !files.length) throw { message: "Ajoute au moins une photo." };
    const big = files.find(f => f.size > MAX_MB * 1048576);
    if (big) throw { message: `La photo « ${big.name} » fait ${(big.size / 1048576).toFixed(1).replace(".", ",")} Mo. Maximum ${MAX_MB} Mo par photo : choisis-en une plus légère.` };
    let slot = null;                                   // essai : 2 publications par jour, chaque place ne sert qu'une fois
    if (!editing && isTrial() && !profile.certified) {
      const taken = new Set(waiting.map(x => x.id)), p = `${user.uid}_${dayKey()}_`;
      slot = [1, 2].map(n => p + n).find(id => !taken.has(id));
      if (!slot) throw { message: quotaText() };
    }
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      say(m, `Envoi de la photo ${i + 1} sur ${files.length}…`);
      urls.push(await uploadImage(await compress(files[i])));
    }
    const cur = ALL_CURRENCIES.includes($("#iCur").value) ? $("#iCur").value : "USD", raw = Number($("#iPrice").value);
    const dec = 10 ** decimalsOf(cur), usd = Math.round(raw * dec) / dec;   // le prix reste dans la monnaie choisie
    if (!(usd > 0)) throw { message: "Prix invalide." };
    const data = {
      title: $("#iTitle").value.trim(), category: $("#iCat").value, price: usd, currency: cur,
      description: $("#iDesc").value.trim(), address: $("#iAddr").value.trim(), city: $("#iCity").value, country: $("#iCountry").value
    };
    const oldRaw = Number($("#iOld").value), tag = $("#iTag").value;
    if ($("#iOld").value && !(oldRaw > usd)) throw { message: "L'ancien prix doit être plus haut que le nouveau prix." };
    if ($("#iOld").value) data.oldPrice = Math.round(oldRaw * dec) / dec;
    if (tag === "promo" || tag === "offre") data.tag = tag;
    say(m, editing ? "Enregistrement…" : "Envoi pour validation…");
    if (editing) {
      // une modification n'est plus appliquée directement : SokoPlus la vérifie avant de la mettre en ligne
      const eid = `${user.uid}_edit_${editing.id}`, old = waiting.find(x => x.id === eid);
      if (old && old.status === "pending") throw { message: "Une modification de cet article attend déjà la validation de SokoPlus. Patiente un instant." };
      if (old) await deleteDoc(doc(db, "submissions", eid));   // ancienne demande refusée
      await setDoc(doc(db, "submissions", eid), {
        ...data, images: urls.length ? urls : editing.images, replaces: editing.id,
        ownerId: user.uid, shopName: profile.shopName, phone: profile.phone, status: "pending", createdAt: serverTimestamp()
      });
      notify("new_submission", { title: data.title, shopName: profile.shopName });
      toast("Modification envoyée. Elle sera en ligne dès que SokoPlus l'aura vérifiée."); 
    } else if (profile.certified) {
      // boutique certifiée par SokoPlus : l'article est en ligne tout de suite, sans validation
      const iid = `${user.uid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(db, "items", iid), {
        ...data, images: urls, ownerId: user.uid, shopName: profile.shopName, phone: profile.phone, shopLogo: profile.logo || "", ...(profile.payments ? { shopPay: profile.payments } : {}),
        certified: true, status: "available", featured: false, createdAt: serverTimestamp()
      });
      pingPush({ type: "item", itemId: iid });
      toast("Ton article est en ligne tout de suite. Boutique certifiée.");
    } else {
      const sub = {
        ...data, images: urls, ownerId: user.uid, shopName: profile.shopName, phone: profile.phone,
        status: "pending", createdAt: serverTimestamp()
      };
      const sid = slot || `${user.uid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;   // l'identifiant commence toujours par ton uid
      await setDoc(doc(db, "submissions", sid), sub);
      notify("new_submission", { title: data.title, shopName: profile.shopName });
      toast("C'est parti ! Ton article est entre nos mains. Dès qu'il est validé, on te prévient.");
    }
    resetForm();
  }, { busy: editing ? "Enregistrement…" : "Envoi…", done: editing ? "Enregistré" : "Envoyé", hold: 1300 })
    .then(() => say(m, "")).catch(err => say(m, nice(err), "err")).finally(renderStatus);
});

/* ---------------- Mes articles ---------------- */
let mine = [], waiting = [], creq = null, creqSeen = false, offMsgs = null;
const when = it => it.createdAt?.toMillis?.() ?? Date.now();
function watchMine() {
  unsub && unsub();
  let firstItems = true, firstSubs = true;
  pub = {}; creq = null; creqSeen = false;
  const u1 = onSnapshot(query(collection(db, "items"), where("ownerId", "==", user.uid)), snap => {
    if (!firstItems) snap.docChanges().forEach(ch => {
      if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) toast(`Ton article « ${ch.doc.data().title} » a été validé. Il est en ligne.`);
    });
    firstItems = false;
    mine = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    mine.sort((a, b) => when(b) - when(a));
    renderMine();
  });
  const u2 = onSnapshot(query(collection(db, "submissions"), where("ownerId", "==", user.uid)), snap => {
    if (!firstSubs) snap.docChanges().forEach(ch => {
      if (ch.type === "modified" && ch.doc.data().status === "rejected") toast(`Ton article « ${ch.doc.data().title} » n'a pas été validé.`);
    });
    firstSubs = false;
    waiting = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    waiting.sort((a, b) => when(b) - when(a));
    renderMine(); renderStatus();
  });
  const u3 = onSnapshot(doc(db, "shops", user.uid), snap => {   // profil public : couverture, à propos, coordonnées
    pub = snap.exists() ? snap.data() : {};
    if (profile) paintCard();
  }, () => { });
  const u5 = onSnapshot(doc(db, "certRequests", user.uid), snap => {   // demande de certification
    creq = snap.exists() ? snap.data() : null; creqSeen = true; renderCert();
  }, () => { creqSeen = true; renderCert(); });
  offMsgs && offMsgs(); offMsgs = onMyNotifs(() => renderCert());
  let seenPlan = false;
  const u4 = onSnapshot(doc(db, "users", user.uid), snap => {   // l'abonnement change en direct quand SokoPlus le met à jour
    if (!snap.exists()) return;
    const was = profile?.activeUntil?.toMillis?.() ?? 0, now = snap.data().activeUntil?.toMillis?.() ?? 0, st = profile?.status;
    profile = snap.data(); renderStatus();
    if (seenPlan && now !== was && !snap.metadata.hasPendingWrites) toast(now > Date.now() ? "SokoPlus a mis à jour ton abonnement." : "Ton abonnement a changé.");
    if (seenPlan && st !== profile.status) toast(profile.status === "blocked" ? "Ton compte a été suspendu." : "Ton compte est de nouveau actif.");
    seenPlan = true;
  });
  unsub = () => { u1(); u2(); u3(); u4(); u5(); offMsgs && offMsgs(); offMsgs = null; };
}
function renderMine() {
  const shown = waiting.filter(it => it.status !== "approved");   // les validées sont déjà dans « mine »
  const n = mine.length + shown.length;
  $("#vsOn").textContent = mine.filter(it => it.status !== "sold").length;
  $("#vsWait").textContent = shown.filter(it => it.status === "pending").length;
  $("#vsSold").textContent = mine.filter(it => it.status === "sold").length;
  $("#mineCount").textContent = n ? `${n} article${n > 1 ? "s" : ""}` : "";
  const wait = shown.map(it => {
    const img = thumb(it.images?.[0], 160);
    return `<div class="it" data-sid="${esc(it.id)}">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph" style="background:${tileColor(profile.shopName)}"></div>`}
      <div class="txt"><b>${esc(it.title)}</b><div class="note">${money(it.price, it.currency)} · ${ago(when(it))}
        ${it.status === "rejected" ? '<span class="pill bad">Refusé</span>' : '<span class="pill warn">En attente de validation</span>'}</div>
        ${it.status === "rejected" && it.reason ? `<div class="note">Motif : ${esc(it.reason)}</div>` : ""}
        ${it.status === "rejected" ? '<div class="row"><button class="btn small ghost" data-a="delsub">Supprimer</button></div>' : ""}
        </div></div>`;
  }).join("");
  $("#mine").innerHTML = n ? wait + mine.map(it => {
    const img = thumb(it.images?.[0], 160);
    return `<div class="it" data-id="${esc(it.id)}">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph" style="background:${tileColor(profile.shopName)}"></div>`}
      <div class="txt"><b>${esc(it.title)}</b><div class="note">${money(it.price, it.currency)} · ${ago(it.createdAt?.toMillis?.() ?? Date.now())}
        ${it.status === "sold" ? '<span class="pill bad">Vendu</span>' : it.featured ? '<span class="pill warn">À la une</span>' : '<span class="pill ok">En ligne</span>'}</div>
        <div class="row"><button class="btn small ghost" data-a="edit">Modifier</button>
        <button class="btn small ghost" data-a="sold">${it.status === "sold" ? "Remettre en vente" : "Marquer vendu"}</button>
        <button class="btn small ghost" data-a="del">Supprimer</button></div></div></div>`;
  }).join("") : `<p class="empty">Ta boutique est prête. Publie ton premier article ci-dessus pour commencer à vendre.</p>`;
}
$("#mine").addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  if (b.dataset.a === "delsub") {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Supprimer"; }, 3000); return; }
    const sid = b.closest("[data-sid]").dataset.sid;
    if (!needNet("Pas de connexion : l'article ne peut pas être supprimé pour l'instant. Réessaie quand le réseau revient.")) return;
    try { await deleteDoc(doc(db, "submissions", sid)); toast("Article supprimé."); } catch (err) { toast(nice(err)); }
    return;
  }
  const it = mine.find(x => x.id === b.closest("[data-id]").dataset.id); if (!it) return;
  if ((b.dataset.a === "sold" || (b.dataset.a === "del" && b.dataset.sure)) && !needNet("Pas de connexion : ton changement n'a pas pu être enregistré. Réessaie quand le réseau revient.")) return;
  try {
    if (b.dataset.a === "sold") await updateDoc(doc(db, "items", it.id), { status: it.status === "sold" ? "available" : "sold" });
    if (b.dataset.a === "del") {
      if (b.dataset.sure) await deleteDoc(doc(db, "items", it.id));
      else { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Supprimer"; }, 3000); }
    }
    if (b.dataset.a === "edit") {
      editing = it;
      $("#iTitle").value = it.title; $("#iCat").value = it.category; $("#iPrice").value = it.price; $("#iCur").value = it.currency || "USD"; $("#iTag").value = it.tag || ""; $("#iOld").value = it.oldPrice || "";
      $("#iDesc").value = it.description || ""; $("#iAddr").value = it.address; fillPlace(it.country || DEFAULT_COUNTRY, it.city || "", it.currency || "USD");
      $("#previews").innerHTML = (it.images || []).map(u => `<img src="${esc(thumb(u, 160))}" alt="">`).join("");
      $("#fTitle").textContent = "Modifier l'article"; $("#iSubmit").textContent = "Enregistrer"; $("#iCancel").hidden = false;
      renderStatus(); $("#iSubmit").disabled = false; showStep(1);
      $("#fItem").scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) { toast(nice(err)); }
});


/* ---------------- Modifier ma boutique : tout s'applique tout de suite, sans validation ---------------- */
const shopDlg = $("#shopDlg"); let newLogo = null, newCover = null, coverGone = false;
function paintLogo(src) {
  const a = $("#sAvatar"); a.style.background = tileColor(profile.shopName);
  a.innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((profile.shopName || "?")[0].toUpperCase());
}
function paintCover(src) {
  $("#sCover").style.cssText = src ? `background-image:url(${esc(src)})` : coverCss("", $("#sName").value || profile.shopName);
  $("#sCoverDel").hidden = !src;
}
function openShop() {
  if (!needNet("Pas de connexion : tu ne peux pas modifier ta boutique pour l'instant.")) return;
  newLogo = newCover = null; coverGone = false; $("#sLogo").value = ""; $("#sCoverFile").value = ""; say($("#sMsg"), "");
  $("#sName").value = profile.shopName; $("#sPhone").value = prettyPhone(profile.phone); $("#sPay").value = profile.payments || "";
  $("#sAbout").value = pub.about || ""; $("#sAddr").value = pub.address || ""; $("#sMail").value = pub.email || "";
  $("#sWeb").value = pub.website || ""; $("#sFb").value = pub.facebook || ""; $("#sIg").value = pub.instagram || "";
  paintLogo(profile.logo ? thumb(profile.logo, 160) : ""); paintCover(pub.cover ? thumb(pub.cover, 900) : "");
  injectIcons(shopDlg); shopDlg.showModal();
}
$("#editShop").onclick = openShop;
shopDlg.addEventListener("click", e => { if (e.target.closest("[data-close]")) shopDlg.close(); });
function pickPhoto(e, set) {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > MAX_MB * 1048576) { e.target.value = ""; return toast(`Cette photo fait ${(f.size / 1048576).toFixed(1).replace(".", ",")} Mo. Maximum ${MAX_MB} Mo.`); }
  set(f);
}
$("#sLogo").addEventListener("change", e => pickPhoto(e, f => { newLogo = f; paintLogo(URL.createObjectURL(f)); }));
$("#sCoverFile").addEventListener("change", e => pickPhoto(e, f => { newCover = f; coverGone = false; paintCover(URL.createObjectURL(f)); }));
$("#sCoverDel").onclick = () => { newCover = null; coverGone = true; $("#sCoverFile").value = ""; paintCover(""); };

$("#fShop").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#sMsg");
  run(btnOf(e), async () => {
    const name = $("#sName").value.trim().replace(/\s+/g, " "), phone = normPhone($("#sPhone").value);
    if (name.length < 2) throw { message: "Le nom de la boutique doit avoir au moins 2 caractères." };
    if (!phone) throw { message: "Numéro invalide. Exemple : 0990 000 001 (RDC) ou +250 788 000 000 (autre pays, avec +)." };
    const mail = $("#sMail").value.trim();
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw { message: "Cette adresse email n'a pas l'air correcte." };
    const website = normLink($("#sWeb").value), facebook = normLink($("#sFb").value, "https://facebook.com/"), instagram = normLink($("#sIg").value, "https://instagram.com/");
    if (website === null) throw { message: "Le lien du site web n'est pas valide. Exemple : https://monsite.com" };
    if (facebook === null) throw { message: "Le lien Facebook n'est pas valide. Colle le lien de ta page ou écris ton nom d'utilisateur." };
    if (instagram === null) throw { message: "Le lien Instagram n'est pas valide. Écris @ton_compte ou colle le lien de ton profil." };
    const pay = $("#sPay").value.trim().replace(/\s+/g, " ").slice(0, 120);
    const phoneChanged = phone !== profile.phone;
    if (phoneChanged && (await getDoc(doc(db, "phoneIndex", phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une boutique." };

    let logo = profile.logo || "", cover = coverGone ? "" : (pub.cover || "");
    if (newLogo) { say(m, "Envoi de la photo de profil…"); logo = await uploadImage(await compress(newLogo, 600)); }
    if (newCover) { say(m, "Envoi de la photo de couverture…"); cover = await uploadImage(await compress(newCover, 1600)); }
    say(m, "Enregistrement…");

    // 1. identité de la boutique (nom, numéro, photo, paiements)
    const patch = {};
    if (name !== profile.shopName) patch.shopName = name;
    if (phoneChanged) patch.phone = phone;
    if (logo !== (profile.logo || "")) patch.logo = logo;
    if (pay !== (profile.payments || "")) patch.payments = pay;
    const changed = Object.keys(patch).length > 0;
    if (changed) await updateDoc(doc(db, "users", user.uid), patch);
    if (phoneChanged) {   // l'index « numéro -> email » suit le nouveau numéro (sert à se connecter avec le téléphone)
      try { await setDoc(doc(db, "phoneIndex", phone), { uid: user.uid, email: profile.email }); }
      catch { await updateDoc(doc(db, "users", user.uid), { phone: profile.phone }).catch(() => { }); throw { message: "Ce numéro est déjà utilisé par une boutique." }; }
      if (profile.phone) await deleteDoc(doc(db, "phoneIndex", profile.phone)).catch(() => { });
    }

    // 2. profil public : couverture, à propos, coordonnées, liens
    const sd = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries({ cover, about: $("#sAbout").value.trim(), address: $("#sAddr").value.trim(), email: mail, website, facebook, instagram })) if (v) sd[k] = v;
    await setDoc(doc(db, "shops", user.uid), sd);

    // 3. les articles déjà en ligne affichent tout de suite le nouveau nom, numéro et logo
    if (changed) {
      const mineSnap = await getDocs(query(collection(db, "items"), where("ownerId", "==", user.uid)));
      await Promise.all(mineSnap.docs.map(d => updateDoc(d.ref, { shopName: name, phone, shopLogo: logo, shopPay: pay })));
    }
    profile = { ...profile, ...patch }; pub = { ...sd }; delete pub.updatedAt;
    renderStatus();
  }, { busy: "Enregistrement…", done: "Enregistré", hold: 700 })
    .then(() => { say(m, ""); shopDlg.close(); toast("Ta boutique est à jour. Les changements sont déjà visibles."); })
    .catch(err => say(m, nice(err), "err"));
});
