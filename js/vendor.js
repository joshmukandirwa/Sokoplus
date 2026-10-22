import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp, Timestamp
} from "./fb.js";
import {
  SITE, configured, configBanner, $, esc, safeUrl, money, normPhone, prettyPhone, waLink,
  compress, uploadImage, thumb, tileColor, toast, ago
} from "./common.js";
import { notify } from "./notify.js";
import { run, btnOf } from "./feedback.js";
import { regionBtnHTML, openRegionPicker, cityLabel } from "./regions.js";

configBanner();
$("#subTxt").textContent = SITE.subscriptionText;
$("#iCat").innerHTML = SITE.categories.map(c => `<option>${esc(c)}</option>`).join("");
$("#iCityHost").innerHTML = regionBtnHTML("", "iCityBtn", "field-like");

let user = null, pending = null, profile = null, editing = null, unsub = null, signingUp = false;
const DAY = 864e5;

const say = (el, text, kind = "") => { el.hidden = !text; el.className = "msg " + kind; el.textContent = text || ""; };
const nice = e => ({
  "auth/email-already-in-use": "Cet email a déjà un compte. Connecte-toi.",
  "auth/invalid-credential": "Email, numéro ou mot de passe incorrect.",
  "auth/wrong-password": "Email, numéro ou mot de passe incorrect.",
  "auth/user-not-found": "Email, numéro ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse email invalide.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/too-many-requests": "Trop d'essais. Attends quelques minutes.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé pour la connexion Google (Authentication > Paramètres > Domaines autorisés).",
  "auth/operation-not-allowed": "La connexion Google n'est pas encore activée dans Firebase.",
  "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres pop-up et réessaie.",
  "auth/network-request-failed": "Pas de connexion internet.",
  "permission-denied": "Action refusée. Vérifie que ton email est confirmé et que ton compte est actif, puis recharge la page et réessaie."
}[e.code] || e.message || "Une erreur est survenue.");

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
  const m = $("#authMsg"), id = $("#loginId").value.trim();
  if (!id.includes("@")) return say(m, "Écris ton adresse email dans le premier champ, puis touche « Mot de passe oublié ».", "warn");
  run($("#forgot"), () => sendPasswordResetEmail(auth, id.toLowerCase()), { busy: "Envoi…", done: "Envoyé", hold: 900 })
    .then(() => say(m, "C'est envoyé. Regarde ta boîte mail (et les spams) pour changer ton mot de passe.", "good"))
    .catch(err => say(m, nice(err), "err"));
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
    const shopName = $("#shopName").value.trim(), email = $("#email").value.trim().toLowerCase(), phone = normPhone($("#phone").value);
    if (!phone) throw { message: "Numéro de téléphone invalide. Exemple : 0990 000 001" };
    if ($("#pw").value !== $("#pw2").value) throw { message: "Les deux mots de passe sont différents." };
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
    try { await sendEmailVerification(cred.user); } catch { /* il pourra le renvoyer */ }
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
  $("#dash").hidden = true; $("#complete").hidden = true; $("#auth").hidden = false; $("#logout").hidden = true;
}
$("#logout").onclick = () => signOut(auth);
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
const PER_DAY = 2;                                  // publications par jour sans abonnement
const isTrial = () => (profile.plan || "essai") === "essai";
const subLeft = () => profile.plan === "pro" ? profile.activeUntil.toMillis() - Date.now() : 0;
const isSub = () => subLeft() > 0;                  // abonné actif : publications illimitées
const dayKey = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");   // jour en RDC (UTC+2)
const midnight = () => (Math.floor((Date.now() + 2 * 3600e3) / DAY) + 1) * DAY - 2 * 3600e3;          // prochain minuit en RDC
const usedToday = () => waiting.filter(x => x.id.startsWith(`${user.uid}_${dayKey()}_`)).length;
const leftToday = () => Math.max(0, PER_DAY - usedToday());
const isFull = () => !!profile && !isSub() && profile.status !== "blocked" && leftToday() === 0;
const p2 = n => String(n).padStart(2, "0");
const fmtHMS = ms => { ms = Math.max(0, ms); return `${p2(Math.floor(ms / 3600e3))} h ${p2(Math.floor(ms % 3600e3 / 60e3))} min ${p2(Math.floor(ms % 60e3 / 1e3))} s`; };
function fmtLeft(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.floor(ms % 60e3 / 1e3);
  return (d ? `${d} j ` : "") + (d || h ? `${p2(h)} h ` : "") + `${p2(m)} min ${p2(s)} s`;
}
const waTo = text => waLink(SITE.adminWhatsapp, `Bonjour SokoPlus, je suis ${profile.shopName} (${prettyPhone(profile.phone)}). ${text}`);

function state() {
  if (!profile) return { ok: false };
  const shop = profile.shopName;
  if (profile.status === "blocked") return { ok: false, label: "Compte suspendu", kind: "bad", why: `${shop}, ton compte est suspendu pour le moment. Écris-nous sur WhatsApp, on t'explique et on règle ça ensemble.`, wa: "Mon compte est suspendu, pouvez-vous m'aider ?" };
  const ms = profile.activeUntil.toMillis() - Date.now(), ok = user.emailVerified;
  if (isSub()) return { ok, label: `Abonnement · ${fmtLeft(ms)}`, kind: ms <= 5 * DAY ? "warn" : "ok" };
  if (isTrial() && ms > 0) return { ok, label: `Essai · ${fmtLeft(ms)}`, kind: ms <= 5 * DAY ? "warn" : "ok" };
  return { ok, label: "Sans abonnement", kind: "warn" };   // essai ou abonnement fini : on garde 2 publications par jour
}

/* Message de quota : une seule source, affichée en haut du formulaire et rappelée à l'étape 5 */
function quotaHTML() {
  const waSub = `<a href="${esc(waTo("Je voudrais m'abonner à SokoPlus."))}" target="_blank" rel="noopener">Passer à l'abonnement (${esc(SITE.subscriptionText)})</a>`;
  if (isSub()) {
    const ms = subLeft(), soon = ms <= 5 * DAY;
    return { cls: soon ? "warn" : "good", html: `<div class="qrow"><b>Abonnement : <span class="qclock" data-until="${profile.activeUntil.toMillis()}" data-fmt="long">${fmtLeft(ms)}</span> restants</b></div>`
      + `<div class="qrow">Publication illimitée.${soon ? ` <a class="btn small warn" href="${esc(waTo("Je voudrais renouveler mon abonnement SokoPlus."))}" target="_blank" rel="noopener">Renouveler sur WhatsApp</a>` : ""}</div>` };
  }
  const left = leftToday(), pips = Array.from({ length: PER_DAY }, (_, i) => `<i class="${i < usedToday() ? "used" : ""}"></i>`).join("");
  const wasSub = profile.plan === "pro", pre = wasSub ? "Ton abonnement est terminé. " : "";
  if (left > 0) return { cls: "good", html: `<div class="qrow"><span class="pips" aria-hidden="true">${pips}</span><b>${pre}Il te reste ${left} publication${left > 1 ? "s" : ""} aujourd'hui</b></div>`
    + `<div class="qrow">Remise à zéro dans <span class="qclock" data-until="${midnight()}" data-fmt="hms">${fmtHMS(midnight() - Date.now())}</span> · ${waSub}</div>` };
  return { cls: "warn", html: `<div class="qrow"><span class="pips" aria-hidden="true">${pips}</span><b>${pre}Tes ${PER_DAY} publications du jour sont utilisées</b></div>`
    + `<div class="qrow">Nouvelle publication dans <span class="qclock" data-until="${midnight()}" data-fmt="hms">${fmtHMS(midnight() - Date.now())}</span></div><div class="qrow">${waSub} pour publier sans limite.</div>` };
}

function renderStatus() {
  const s = state();
  $("#dShop").textContent = profile.shopName;
  $("#dContact").textContent = `${prettyPhone(profile.phone)} · ${profile.email}`;
  const pill = $("#dStatus"); pill.textContent = s.label || ""; pill.className = "pill " + (s.kind || "");
  $("#verifyBox").hidden = user.emailVerified; $("#verifyMail").textContent = profile.email;
  const bb = $("#blockBox");
  bb.hidden = !s.why;
  if (s.why) bb.innerHTML = `${esc(s.why)} <a href="${esc(waTo(s.wa || "Je voudrais activer mon abonnement."))}" target="_blank" rel="noopener">${s.cta || "Écrire sur WhatsApp"}</a>`;
  const q = quotaHTML(), qb = $("#quotaBox"), qr = $("#quotaRecap");
  qb.hidden = !!s.why; qb.className = "quota " + q.cls; qb.innerHTML = q.html;
  qr.className = "quota " + q.cls; qr.innerHTML = q.html;
  syncSubmit();
}
function syncSubmit() {
  const s = state(), full = isFull() && !editing, b = $("#iSubmit");
  if (b.dataset.fx) return;
  b.disabled = !s.ok && !editing || full || (profile.status === "blocked" && !editing);
  b.textContent = editing ? "Enregistrer" : full ? `Prochaine publication dans ${fmtHMS(midnight() - Date.now())}` : "Envoyer pour validation";
}
/* Comptes à rebours : tout défile en direct, une fois par seconde */
setInterval(() => {
  if (!profile || !user || $("#dash").hidden) return;
  const s = state(), pill = $("#dStatus");
  if (pill.textContent !== s.label) { pill.textContent = s.label; pill.className = "pill " + (s.kind || ""); }
  let again = false;
  document.querySelectorAll(".qclock").forEach(el => {
    const ms = Number(el.dataset.until) - Date.now();
    if (ms <= 0) { again = true; return; }
    el.textContent = el.dataset.fmt === "hms" ? fmtHMS(ms) : fmtLeft(ms);
  });
  if (again) renderStatus(); else syncSubmit();
}, 1000);
$("#resend").onclick = async () => { try { await sendEmailVerification(user); toast("Lien renvoyé. Regarde aussi dans les spams."); } catch (e) { toast(nice(e)); } };
$("#refresh").onclick = async () => { await user.reload(); await user.getIdToken(true); renderStatus(); if (!user.emailVerified) toast("Email pas encore vérifié."); };

/* ---------------- Formulaire article : 5 étapes ---------------- */
const STEPS = ["Article", "Photos", "Prix", "Lieu", "Récapitulatif"];
let step = 1, picked = [], cur = "USD";

function setCity(c) {
  $("#iCity").value = c || "";
  $("#iCityBtn span").textContent = c ? cityLabel(c) : "Choisis ta région";
}
$("#iCityBtn").onclick = () => openRegionPicker({ current: $("#iCity").value, all: false, onPick: setCity });

function setCur(c) {
  cur = c;
  document.querySelectorAll(".curpick button").forEach(b => b.setAttribute("aria-pressed", b.dataset.cur === c));
  $("#priceLbl").textContent = c === "FC" ? "Prix en francs congolais (FC)" : "Prix en dollars (USD)";
  $("#iPrice").placeholder = c === "FC" ? "Ex. 50000" : "Ex. 25";
  $("#iPrice").inputMode = c === "FC" ? "numeric" : "decimal";
}
document.querySelector(".curpick").addEventListener("click", e => { const b = e.target.closest("[data-cur]"); if (b) setCur(b.dataset.cur); });

function goStep(n, scroll = true) {
  step = n;
  document.querySelectorAll(".step").forEach(el => { el.hidden = Number(el.dataset.step) !== n; });
  document.querySelectorAll(".wizbar i").forEach((el, i) => el.classList.toggle("on", i < n));
  $("#wizLbl").textContent = `Étape ${n} sur 5 · ${STEPS[n - 1]}`;
  $("#wBack").hidden = n === 1; $("#wNext").hidden = n === 5; $("#iSubmit").hidden = n !== 5;
  say($("#iMsg"), "");
  if (n === 5) renderRecap();
  if (scroll) $("#fItem").scrollIntoView({ behavior: "smooth", block: "start" });
}
const amountOf = () => { const v = Number($("#iPrice").value); return cur === "FC" ? Math.round(v) : Math.round(v * 100) / 100; };
function checkStep(n) {
  if (n === 1) {
    if ($("#iTitle").value.trim().length < 2) return "Donne un nom à ton article (2 lettres minimum).";
    if (!$("#iCat").value) return "Choisis une catégorie.";
  }
  if (n === 2 && !picked.length && !(editing && editing.images?.length)) return "Ajoute au moins une photo pour continuer.";
  if (n === 3) {
    const v = amountOf();
    if (!(v > 0)) return "Entre un prix valide.";
    if (v >= (cur === "FC" ? 1e8 : 1e6)) return `Ce prix est trop élevé en ${cur === "FC" ? "FC" : "dollars"}. Vérifie la monnaie choisie.`;
  }
  if (n === 4) {
    if (!$("#iCity").value) return "Choisis ta région.";
    if (!$("#iAddr").value.trim()) return "Écris ton quartier ou ton adresse.";
  }
  return "";
}
function next() {
  const err = checkStep(step);
  if (err) return say($("#iMsg"), err, "err");
  goStep(step + 1);
}
$("#wNext").onclick = next;
$("#wBack").onclick = () => goStep(step - 1);

/* Photos : ajout par petits lots, aperçu, suppression d'une photo */
function drawPhotos() {
  const box = $("#previews");
  if (picked.length) {
    box.innerHTML = picked.map((p, i) => `<div class="pv"><img src="${esc(p.url)}" alt="Photo ${i + 1}"><button type="button" class="pvx" data-i="${i}" aria-label="Supprimer la photo ${i + 1}">✕</button></div>`).join("");
    $("#photoNote").textContent = `${picked.length} photo${picked.length > 1 ? "s" : ""} sur 3.`;
  } else if (editing?.images?.length) {
    box.innerHTML = editing.images.map(u => `<div class="pv"><img src="${esc(thumb(u, 160))}" alt=""></div>`).join("");
    $("#photoNote").textContent = "Tes photos actuelles sont gardées. Ajoute-en de nouvelles pour les remplacer.";
  } else { box.innerHTML = ""; $("#photoNote").textContent = ""; }
}
function clearPhotos() { picked.forEach(p => URL.revokeObjectURL(p.url)); picked = []; }
$("#iImgs").addEventListener("change", e => {
  for (const f of [...e.target.files]) {
    if (picked.length >= 3) { toast("3 photos maximum par article."); break; }
    if (!f.type.startsWith("image/")) continue;
    if (f.size > MAX_MB * 1048576) { toast(`La photo « ${f.name} » est trop lourde (${(f.size / 1048576).toFixed(1).replace(".", ",")} Mo). Maximum ${MAX_MB} Mo par photo.`); continue; }
    picked.push({ file: f, url: URL.createObjectURL(f) });
  }
  e.target.value = ""; drawPhotos();
});
$("#previews").addEventListener("click", e => {
  const b = e.target.closest(".pvx"); if (!b) return;
  const [p] = picked.splice(Number(b.dataset.i), 1); p && URL.revokeObjectURL(p.url); drawPhotos();
});

function renderRecap() {
  const pic = picked[0]?.url || (editing?.images?.[0] ? thumb(editing.images[0], 400) : "");
  const where = [cityLabel($("#iCity").value), $("#iAddr").value.trim()].filter(Boolean).join(" · ");
  const desc = $("#iDesc").value.trim();
  $("#recap").innerHTML = `<div class="rc">${pic ? `<img src="${esc(pic)}" alt="">` : ""}<div><b>${esc($("#iTitle").value.trim())}</b>
    <div class="price">${esc(money(amountOf(), cur))}</div><div class="note">${esc($("#iCat").value)} · ${esc(where)}</div>
    ${desc ? `<p class="rcd">${esc(desc.length > 140 ? desc.slice(0, 140) + "…" : desc)}</p>` : ""}</div></div>`
    + `<p class="note">${picked.length || editing?.images?.length || 0} photo(s) · prix en ${cur === "FC" ? "francs congolais" : "dollars"}. Vérifie tout, puis envoie.</p>`;
}

function resetForm() {
  editing = null; $("#fItem").reset(); clearPhotos(); drawPhotos(); setCur("USD"); setCity("");
  $("#fTitle").textContent = "Publier un article"; $("#iCancel").hidden = true;
  goStep(1, false); renderStatus();
}
$("#iCancel").onclick = resetForm;
setCur("USD"); setCity(""); goStep(1, false);

$("#fItem").addEventListener("submit", e => {
  e.preventDefault();
  if (step < 5) return next();                         // Entrée au clavier = Continuer
  const m = $("#iMsg"), btn = $("#iSubmit");
  for (let n = 1; n <= 4; n++) { const er = checkStep(n); if (er) { goStep(n); return say(m, er, "err"); } }
  run(btn, async () => {
    const files = picked.map(p => p.file);
    let slot = null;                                   // sans abonnement : 2 publications par jour, chaque place ne sert qu'une fois
    if (!editing && !isSub()) {
      const taken = new Set(waiting.map(x => x.id)), p = `${user.uid}_${dayKey()}_`;
      slot = [1, 2].map(n => p + n).find(id => !taken.has(id));
      if (!slot) throw { message: `${profile.shopName}, tes ${PER_DAY} publications du jour sont utilisées. La prochaine est possible dans ${fmtHMS(midnight() - Date.now())}.` };
    }
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      say(m, `Envoi de la photo ${i + 1} sur ${files.length}…`);
      urls.push(await uploadImage(await compress(files[i])));
    }
    const data = {
      title: $("#iTitle").value.trim(), category: $("#iCat").value, price: amountOf(), currency: cur,
      description: $("#iDesc").value.trim(), address: $("#iAddr").value.trim(), city: $("#iCity").value
    };
    say(m, editing ? "Enregistrement…" : "Envoi pour vérification…");
    if (editing) {
      await updateDoc(doc(db, "items", editing.id), { ...data, images: urls.length ? urls : editing.images });
      toast("C'est enregistré, ton article est à jour.");
    } else {
      const sub = {
        ...data, images: urls, ownerId: user.uid, shopName: profile.shopName, phone: profile.phone,
        status: "pending", createdAt: serverTimestamp()
      };
      if (slot) await setDoc(doc(db, "submissions", slot), sub); else await addDoc(collection(db, "submissions"), sub);
      notify("new_submission", { title: data.title, shopName: profile.shopName });
      toast("Article reçu. Il passe en vérification, on te prévient dès qu'il est en ligne.");
    }
    resetForm();
  }, { busy: editing ? "Enregistrement…" : "Envoi…", done: editing ? "Enregistré" : "Envoyé", hold: 1300 })
    .then(() => say(m, "")).catch(err => say(m, nice(err), "err")).finally(renderStatus);
});

/* ---------------- Mes articles ---------------- */
let mine = [], waiting = [];
const when = it => it.createdAt?.toMillis?.() ?? Date.now();
function watchMine() {
  unsub && unsub();
  let firstItems = true, firstSubs = true;
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
  unsub = () => { u1(); u2(); };
}
function renderMine() {
  const shown = waiting.filter(it => it.status !== "approved");   // les validées sont déjà dans « mine »
  const n = mine.length + shown.length;
  $("#mineCount").textContent = n ? `${n} article${n > 1 ? "s" : ""}` : "";
  const wait = shown.map(it => {
    const img = thumb(it.images?.[0], 160);
    return `<div class="it" data-sid="${esc(it.id)}">
      ${img ? `<img src="${esc(img)}" alt="">` : `<div class="ph" style="background:${tileColor(profile.shopName)}"></div>`}
      <div class="txt"><b>${esc(it.title)}</b><div class="note">${money(it.price, it.currency)} · ${ago(when(it))}
        ${it.status === "rejected" ? '<span class="pill bad">Refusé</span>' : '<span class="pill warn">En attente de validation</span>'}</div>
        ${it.status === "rejected" && it.reason ? `<div class="note">Motif : ${esc(it.reason)}</div>` : ""}
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
  }).join("") : `<p class="empty">Aucun article pour l'instant. Publie le premier ci-dessus.</p>`;
}
$("#mine").addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  if (b.dataset.a === "delsub") {
    const sid = b.closest("[data-sid]").dataset.sid;
    try { await deleteDoc(doc(db, "submissions", sid)); } catch (err) { toast(nice(err)); }
    return;
  }
  const it = mine.find(x => x.id === b.closest("[data-id]").dataset.id); if (!it) return;
  try {
    if (b.dataset.a === "sold") await updateDoc(doc(db, "items", it.id), { status: it.status === "sold" ? "available" : "sold" });
    if (b.dataset.a === "del") {
      if (b.dataset.sure) await deleteDoc(doc(db, "items", it.id));
      else { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Supprimer"; }, 3000); }
    }
    if (b.dataset.a === "edit") {
      editing = it; clearPhotos();
      $("#iTitle").value = it.title; $("#iCat").value = it.category; $("#iPrice").value = it.price;
      $("#iDesc").value = it.description || ""; $("#iAddr").value = it.address;
      setCur(it.currency === "FC" ? "FC" : "USD"); setCity(it.city || ""); drawPhotos();
      $("#fTitle").textContent = "Modifier l'article"; $("#iCancel").hidden = false;
      goStep(1); syncSubmit();
    }
  } catch (err) { toast(nice(err)); }
});
