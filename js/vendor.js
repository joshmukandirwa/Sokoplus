import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, serverTimestamp, Timestamp
} from "./fb.js";
import {
  SITE, configured, configBanner, $, $$, esc, safeUrl, money, normPhone, prettyPhone, waLink,
  compress, uploadImage, thumb, tileColor, toast, ago
} from "./common.js";
import { notify } from "./notify.js";
import { run, btnOf } from "./feedback.js";

configBanner();
$("#subTxt").textContent = SITE.subscriptionText;
$("#iCat").innerHTML = SITE.categories.map(c => `<option>${esc(c)}</option>`).join("");
$("#iCity").innerHTML = '<option value="">Choisis ta ville</option>' + SITE.cities.map(c => `<option>${esc(c)}</option>`).join("");

let user = null, pending = null, profile = null, editing = null, unsub = null, signingUp = false;
const DAY = 864e5;

const say = (el, text, kind = "") => { el.hidden = !text; el.className = "msg " + kind; el.textContent = text || ""; };
const nice = e => ({
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
  "permission-denied": "Cette action n'est pas possible pour le moment. Vérifie que ton email est confirmé et que ton compte est actif, puis recharge la page."
}[e.code] || e.message || "Oups, quelque chose n'a pas marché. Réessaie dans un instant.");

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
  return { ok: user.emailVerified, label: `${trial ? "Essai" : "Abonnement"} · ${fmtLeft(ms)}`, kind: ms <= 5 * DAY ? "warn" : "ok" };
}

function renderStatus() {
  const s = state();
  const hr = new Date().getHours();
  $("#dHello").textContent = `${hr < 12 ? "Bonjour" : hr < 18 ? "Bon après-midi" : "Bonsoir"}, content de te revoir.`;
  $("#dShop").textContent = profile.shopName;
  const av = $("#dAvatar"); av.style.background = tileColor(profile.shopName);
  av.innerHTML = profile.logo ? `<img src="${esc(thumb(profile.logo, 160))}" alt="">` : esc((profile.shopName || "?")[0].toUpperCase());
  $("#dContact").textContent = `${prettyPhone(profile.phone)} · ${profile.email}`;
  const pill = $("#dStatus"); pill.textContent = s.label || ""; pill.className = "pill " + (s.kind || "");
  $("#verifyBox").hidden = user.emailVerified; $("#verifyMail").textContent = profile.email;
  const bb = $("#blockBox");
  bb.hidden = !s.why;
  if (s.why) bb.innerHTML = `${esc(s.why)} <a href="${esc(waLink(SITE.adminWhatsapp, `Bonjour SokoPlus, je suis ${profile.shopName} (${prettyPhone(profile.phone)}). ${s.wa || "Je voudrais activer mon abonnement."}`))}" target="_blank" rel="noopener">${s.cta || "Écrire sur WhatsApp"}</a>`;
  lastDay = dayKey();
  const trial = isTrial(), used = usedToday(), full = trial && used >= 2 && !s.why, qb = $("#quotaBox");
  qb.hidden = !(trial && !s.why);
  if (!qb.hidden) {
    const left = Math.max(0, 2 - used);
    qb.className = "qbox " + (full ? "full" : "open");
    qb.innerHTML = `<div class="qdots" aria-hidden="true">${[0, 1].map(n => `<i class="${n < used ? "on" : ""}"></i>`).join("")}</div>
      <div class="qtx"><b>${full ? "Tu as utilisé tes 2 publications du jour" : `Encore ${left} publication${left > 1 ? "s" : ""} aujourd'hui`}</b>
        <small>${full ? `${esc(profile.shopName)}, la prochaine publication gratuite s'ouvre dans` : "Le compteur repart à zéro dans"} <span class="qcd" data-reset></span>.${full ? " Pour publier sans limite, passe à la version complète." : ""}</small>
        ${full ? `<a class="btn small" href="${esc(waLink(SITE.adminWhatsapp, `Bonjour SokoPlus, je suis ${profile.shopName} (${prettyPhone(profile.phone)}). Je voudrais passer à la version complète de SokoPlus.`))}" target="_blank" rel="noopener">Passer à la version complète</a>` : ""}</div>`;
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
$("#resend").onclick = async () => { try { await sendEmailVerification(user); toast("Lien renvoyé. Regarde aussi dans les spams."); } catch (e) { toast(nice(e)); } };
$("#refresh").onclick = async () => { await user.reload(); await user.getIdToken(true); renderStatus(); if (!user.emailVerified) toast("Email pas encore vérifié."); };

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
  showStep(1); renderStatus();
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
  const cur = $("#iCur").value === "FC" ? "FC" : "USD", price = Number($("#iPrice").value), desc = $("#iDesc").value.trim();
  const after = isTrial() && !editing ? Math.max(0, 1 - usedToday()) : null;   // publications restantes après cet envoi
  $("#recap").innerHTML = `<div class="rprev">${$("#previews").innerHTML}</div>
    <h3>${esc($("#iTitle").value.trim())}</h3>
    <div class="rprice">${money(cur === "FC" ? Math.round(price) : price, cur)}</div>
    <dl class="rlist"><div><dt>Catégorie</dt><dd>${esc($("#iCat").value)}</dd></div>
      <div><dt>Lieu</dt><dd>${esc($("#iCity").value)}, ${esc($("#iAddr").value.trim())}</dd></div>
      ${desc ? `<div><dt>Description</dt><dd>${esc(desc)}</dd></div>` : ""}</dl>
    <p class="note">${editing ? "Tes modifications sont enregistrées tout de suite."
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
    if (!editing && isTrial()) {
      const taken = new Set(waiting.map(x => x.id)), p = `${user.uid}_${dayKey()}_`;
      slot = [1, 2].map(n => p + n).find(id => !taken.has(id));
      if (!slot) throw { message: quotaText() };
    }
    const urls = [];
    for (let i = 0; i < files.length; i++) {
      say(m, `Envoi de la photo ${i + 1} sur ${files.length}…`);
      urls.push(await uploadImage(await compress(files[i])));
    }
    const cur = $("#iCur").value === "FC" ? "FC" : "USD", raw = Number($("#iPrice").value);
    const usd = cur === "FC" ? Math.round(raw) : Math.round(raw * 100) / 100;   // le prix reste dans la monnaie choisie
    if (!(usd > 0)) throw { message: "Prix invalide." };
    const data = {
      title: $("#iTitle").value.trim(), category: $("#iCat").value, price: usd, currency: cur,
      description: $("#iDesc").value.trim(), address: $("#iAddr").value.trim(), city: $("#iCity").value
    };
    say(m, editing ? "Enregistrement…" : "Envoi pour validation…");
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
      toast("C'est parti ! Ton article est entre nos mains. Dès qu'il est validé, on te prévient.");
    }
    resetForm();
  }, { busy: editing ? "Enregistrement…" : "Envoi…", done: editing ? "Enregistré" : "Envoyé", hold: 1300 })
    .then(() => say(m, "")).catch(err => say(m, nice(err), "err")).finally(renderStatus);
});

/* ---------------- Mes articles ---------------- */
let mine = [], waiting = [], req = null, reqSeen = false;
const when = it => it.createdAt?.toMillis?.() ?? Date.now();
function watchMine() {
  unsub && unsub();
  let firstItems = true, firstSubs = true;
  req = null; reqSeen = false;
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
  const u3 = onSnapshot(doc(db, "profileRequests", user.uid), async snap => {   // demande de modification de la boutique
    const was = req; req = snap.exists() ? snap.data() : null;
    if (reqSeen && was?.status === "pending" && !req) {   // la demande a disparu : elle a été validée
      const p = await getDoc(doc(db, "users", user.uid)); if (p.exists()) profile = p.data();
      toast("SokoPlus a validé les modifications de ta boutique."); renderStatus();
    }
    if (reqSeen && was?.status === "pending" && req?.status === "rejected") toast("SokoPlus n'a pas pu valider tes modifications. Le motif est dans Ma boutique.");
    reqSeen = true; renderReq();
  });
  unsub = () => { u1(); u2(); u3(); };
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
      editing = it;
      $("#iTitle").value = it.title; $("#iCat").value = it.category; $("#iPrice").value = it.price; $("#iCur").value = it.currency || "USD";
      $("#iDesc").value = it.description || ""; $("#iAddr").value = it.address; $("#iCity").value = it.city || "";
      $("#previews").innerHTML = (it.images || []).map(u => `<img src="${esc(thumb(u, 160))}" alt="">`).join("");
      $("#fTitle").textContent = "Modifier l'article"; $("#iSubmit").textContent = "Enregistrer"; $("#iCancel").hidden = false;
      renderStatus(); $("#iSubmit").disabled = false; showStep(1);
      $("#fItem").scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) { toast(nice(err)); }
});


/* ---------------- Modifier ma boutique : nom, numéro, photo (validés par SokoPlus) ---------------- */
const shopDlg = $("#shopDlg"); let newLogo = null;
function renderReq() {
  const b = $("#reqBox"); $("#editShop").disabled = req?.status === "pending";
  if (!req) { b.hidden = true; return; }
  const what = [req.shopName && `nom : ${esc(req.shopName)}`, req.phone && `numéro : ${esc(prettyPhone(req.phone))}`, req.logo && "nouvelle photo de profil"].filter(Boolean).join(", ");
  b.hidden = false;
  if (req.status === "pending") {
    b.className = "msg warn";
    b.innerHTML = `<b>Ta demande est en cours de vérification par SokoPlus.</b> On te prévient dès qu'elle est traitée. Demandé : ${what}.`;
  } else {
    b.className = "msg err";
    b.innerHTML = `<b>SokoPlus n'a pas pu valider ta demande.</b>${req.reason ? ` Motif : ${esc(req.reason)}.` : ""} <button class="btn small" id="reqRetry" type="button">Refaire une demande</button>`;
    $("#reqRetry").onclick = openShop;
  }
}
function paintLogo(src) {
  const a = $("#sAvatar"); a.style.background = tileColor(profile.shopName);
  a.innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((profile.shopName || "?")[0].toUpperCase());
}
async function openShop() {
  try { if (req?.status === "rejected") await deleteDoc(doc(db, "profileRequests", user.uid)); } catch (err) { return toast(nice(err)); }
  newLogo = null; $("#sLogo").value = ""; say($("#sMsg"), "");
  $("#sName").value = profile.shopName; $("#sPhone").value = prettyPhone(profile.phone);
  paintLogo(profile.logo ? thumb(profile.logo, 160) : ""); shopDlg.showModal();
}
$("#editShop").onclick = openShop;
shopDlg.addEventListener("click", e => { if (e.target === shopDlg || e.target.closest("[data-close]")) shopDlg.close(); });
$("#sLogo").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > MAX_MB * 1048576) { e.target.value = ""; return toast(`Cette photo fait ${(f.size / 1048576).toFixed(1).replace(".", ",")} Mo. Maximum ${MAX_MB} Mo.`); }
  newLogo = f; paintLogo(URL.createObjectURL(f));
});
$("#fShop").addEventListener("submit", e => {
  e.preventDefault();
  const m = $("#sMsg");
  run($("#sSend"), async () => {
    const name = $("#sName").value.trim(), phone = normPhone($("#sPhone").value), data = {};
    if (name.length < 2) throw { message: "Le nom de la boutique doit avoir au moins 2 caractères." };
    if (!phone) throw { message: "Numéro invalide. Exemple : 0990 000 001 ou +243 990 000 001." };
    if (name !== profile.shopName) data.shopName = name;
    if (phone !== profile.phone) {
      if ((await getDoc(doc(db, "phoneIndex", phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une boutique." };
      data.phone = phone;
    }
    if (newLogo) { say(m, "Envoi de la photo…"); data.logo = await uploadImage(await compress(newLogo)); }
    if (!Object.keys(data).length) throw { message: "Rien n'a changé : modifie le nom, le numéro ou la photo." };
    await setDoc(doc(db, "profileRequests", user.uid), { ...data, status: "pending", createdAt: serverTimestamp() });
    notify("new_submission", { title: "Modification de la boutique", shopName: profile.shopName });
  }, { busy: "Envoi…", done: "Envoyé", hold: 900 })
    .then(() => { say(m, ""); shopDlg.close(); toast("Demande envoyée. SokoPlus la vérifie et te prévient."); })
    .catch(err => say(m, nice(err), "err"));
});
