import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp,
  collection, query, orderBy, limit, where, getDocs, onSnapshot, Timestamp, addDoc
} from "./fb.js";
import { SITE, configured, configBanner, $, $$, esc, safeUrl, money, prettyPhone, phoneIssue, waLink, ago, toast, thumb, tileColor, compress, uploadImage, isNetErr, failText, NET_MSG } from "./common.js";
import { icon } from "./icons.js";
import { eyeHTML } from "./vues.js";
import { KINDS } from "./annonces.js";
import { notify } from "./notify.js";
import { run, btnOf } from "./feedback.js";
import { bindLogout } from "./logout.js";
import { pingPush } from "./pushapi.js";
import { homeHTML, chartTip } from "./admin-home.js";
import { priceHtml, priceText, struck, fmt as fmtMoney } from "./pricing.js";

configBanner();
const DAY = 864e5;
let buyers = [], range = 7, revs = [], pubRevs = [], maint = null, tab = "home", users = [], items = [], anns = [], viewsMap = new Map(), reports = [], subs = [], reqs = [], creqs = [], unsubs = [], firstSubs = true, firstReqs = true, firstRevs = true, firstCreqs = true;

const say = (t, kind = "") => { const m = $("#aMsg"); m.hidden = !t; m.className = "msg " + kind; m.textContent = t || ""; };

$("#fLogin").addEventListener("submit", e => {
  e.preventDefault(); say("On vérifie tes infos…");
  run(btnOf(e), () => signInWithEmailAndPassword(auth, $("#aMail").value.trim().toLowerCase(), $("#aPw").value), { busy: "Connexion…", done: "Bienvenue", hold: 600 })
    .catch(err => say(isNetErr(err) ? NET_MSG : "Email ou mot de passe incorrect.", "err"));
});
$("#aGoogle").onclick = () => {
  say("Ouverture de Google…");
  run($("#aGoogle"), () => signInWithPopup(auth, new GoogleAuthProvider()), { hold: 500 })
    .then(() => say(""))
    .catch(err => { say(["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code) ? "" : (isNetErr(err) ? NET_MSG : "Connexion Google impossible : " + (err.code || err.message)), "err"); });
};
bindLogout($("#logout"), () => signOut(auth));
bindLogout($("#logout2"), () => signOut(auth));
const shell = on => document.body.classList.toggle("ad-in", on);   // l'espace admin remplace l'en-tête de la page de connexion

if (!configured) say("Firebase n'est pas configuré (voir README).", "warn");
else onAuthStateChanged(auth, async u => {
  unsubs.forEach(f => f()); unsubs = [];
  if (!u) { $("#login").hidden = false; $("#panel").hidden = true; $("#logout").hidden = true; shell(false); return; }
  const ok = (u.emailVerified && (u.email || "").toLowerCase() === SITE.adminEmail) || (await getDoc(doc(db, "admins", u.uid))).exists();
  if (!ok) {   // on ne déconnecte plus : la session du vendeur (même navigateur) reste ouverte
    $("#login").hidden = false; $("#panel").hidden = true; $("#logout").hidden = false; shell(false);
    say(`Tu es connecté avec ${u.email || "un autre compte"}, qui n'est pas administrateur. Ta session reste ouverte : touche « Déconnexion » seulement si tu veux changer de compte.`, "warn");
    return;
  }
  $("#login").hidden = true; $("#panel").hidden = false; $("#logout").hidden = false; shell(true); say("");
  firstSubs = true; firstReqs = true; firstRevs = true; firstCreqs = true;
  unsubs.push(
    onSnapshot(query(collection(db, "submissions"), orderBy("createdAt", "desc"), limit(100)), s => {
      if (!firstSubs) s.docChanges().forEach(ch => {
        if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) toast(`Nouvel article à valider : ${ch.doc.data().title}`, { onClick: () => { tab = "pending"; render(); } });
      });
      firstSubs = false;
      subs = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
    }),
    onSnapshot(collection(db, "profileRequests"), s => {
      if (!firstReqs) s.docChanges().forEach(ch => {
        if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) toast(`Demande de modification de boutique : ${users.find(x => x.id === ch.doc.id)?.shopName || "une boutique"}`, { onClick: () => { tab = "pending"; render(); } });
      });
      firstReqs = false;
      reqs = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
    }),
    onSnapshot(collection(db, "certRequests"), s => {
      if (!firstCreqs) s.docChanges().forEach(ch => {
        if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites && ch.doc.data().status === "pending") toast(`Demande de certification : ${users.find(x => x.id === ch.doc.id)?.shopName || "une boutique"}`, { onClick: () => { tab = "pending"; render(); } });
      });
      firstCreqs = false;
      creqs = s.docs.map(d => ({ id: d.id, ...d.data() })); render();
    }),
    onSnapshot(query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(200)), s => {
      if (!firstRevs) s.docChanges().forEach(ch => {
        if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites && ch.doc.data().status === "pending") toast("Nouvel avis à valider", { onClick: () => { tab = "pending"; render(); } });
      });
      firstRevs = false; const all = s.docs.map(d => ({ id: d.id, ...d.data() })); revs = all.filter(r => r.status !== "approved"); pubRevs = all.filter(r => r.status === "approved"); render();
    }),
    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(100)), s => { anns = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { }),
    onSnapshot(doc(db, "config", "maintenance"), s => { maint = s.exists() ? s.data() : null; paintMaint(); }),
    onSnapshot(doc(db, "config", "theme"), s => { festive = s.exists() && FEST[s.data().festive] ? s.data().festive : "auto"; paintFest(); }, () => { }),
    onSnapshot(doc(db, "config", "pricing"), s => { pricingDoc = s.exists() ? s.data() : null; if (tab === "price") render(); }, () => { }),
    onSnapshot(collection(db, "buyers"), s => { buyers = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { }),
    onSnapshot(collection(db, "users"), s => { users = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc"), limit(200)), s => { items = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100)), s => { reports = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); })
  );
});

const until = u => u.activeUntil?.toMillis?.() ?? 0;
const dateFr = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const norm = t => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ini = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
/* Pastille d'une boutique : sa photo de profil si elle en a une, sinon ses initiales (la lettre reste visible si la photo ne charge pas) */
const av = (n, logo) => `<span class="a-av" style="background:${tileColor(n)}">${esc(ini(n))}${logo ? `<img src="${esc(thumb(logo, 120))}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : ""}</span>`;
const left = u => until(u) - Date.now();
const fmtD = m => {
  const d = Math.floor(m / DAY), h = Math.floor(m % DAY / 36e5), mi = Math.floor(m % 36e5 / 6e4), s = Math.floor(m % 6e4 / 1e3);
  return d ? `${d} j ${h} h ${mi} min ${s} s` : h ? `${h} h ${mi} min ${s} s` : `${mi} min ${s} s`;
};
const userState = u => u.status === "blocked" ? "blocked" : left(u) <= 0 ? "expired" : u.plan === "pro" ? "pro" : "trial";
const when = x => x?.toMillis?.() ?? Date.now();
const LATE = 24 * 3600e3;
const late = x => x.status === "pending" && Date.now() - when(x.createdAt) > LATE;   // en attente depuis plus de 24 h
const lateTag = x => late(x) ? `<span class="pill bad">En attente depuis ${fmtLate(Date.now() - when(x.createdAt))}</span> ` : "";
const fmtLate = ms => ms < 48 * 3600e3 ? Math.floor(ms / 3600e3) + " h" : Math.floor(ms / 864e5) + " jours";
const empty = (ic, t) => `<div class="a-empty">${icon(ic)}<p>${esc(t)}</p></div>`;
const chips = { pending: "wait", users: "all", items: "all" };
let fxNext = true;

function chipsHTML(defs, cnt) {
  $("#aChips").innerHTML = defs.map(([k, l]) => `<button class="a-chip" data-c="${k}" aria-pressed="${chips[tab] === k}">${l}<em>${cnt[k] || 0}</em></button>`).join("");
}

/* Fiabilité du numéro : « faux » (indicatif inexistant, RDC incomplet…), « non confirmé » (facultatif) ou « confirmé » */
const phoneKind = u => !u.phone || phoneIssue(String(u.phone)) !== "" ? "suspect" : u.phoneVerified ? "ok" : "unconf";
function phoneTag(u) {
  const bad = !u.phone || phoneIssue(String(u.phone)) !== "";
  if (bad) return '<span class="pill bad" title="Ce numéro ne peut pas exister : probablement un faux numéro">Numéro suspect</span>';
  return u.phoneVerified ? '<span class="pill ok" title="Le vendeur t\'a écrit sur WhatsApp depuis ce numéro">Numéro confirmé</span>' : '<span class="pill" title="Numéro plausible, pas encore confirmé par un message WhatsApp (facultatif)">Non confirmé</span>';
}
function userCard(u) {
  const st = userState(u), ms = left(u), mine = items.filter(i => i.ownerId === u.id);
  const pill = { blocked: '<span class="pill bad">Bloquée</span>', expired: '<span class="pill bad">Expirée</span>', pro: '<span class="pill ok">Abonnée</span>', trial: '<span class="pill warn">Essai</span>' }[st];
  const pct = st === "blocked" || ms <= 0 ? 0 : Math.min(100, Math.round(ms / (30 * DAY) * 100));
  const meter = st === "blocked" ? "Compte suspendu" : ms <= 0 ? `Terminé le ${dateFr(until(u))}` : `${fmtD(ms)} restants, jusqu'au ${dateFr(until(u))}`;
  return `<article class="a-card" data-row data-uid="${esc(u.id)}">
    <div class="a-head">${av(u.shopName, u.logo)}<div class="a-id"><b>${esc(u.shopName)}${u.certified ? ' <span class="cert" title="Certifiée"><img class="cert-ic" src="icons/certifie.png" width="14" height="14" alt="" draggable="false"> Certifiée</span>' : ""}</b><small>${esc(prettyPhone(u.phone))} · ${esc(u.email)}</small>${phoneTag(u)}</div>${pill}</div>
    <div class="a-meter ${st}"><div class="a-bar"><i style="width:${pct}%"></i></div><span${st === "trial" || st === "pro" ? ` data-until="${until(u)}"` : ""}>${esc(meter)}</span></div>
    <div class="a-stats"><span><b>${mine.filter(i => i.status !== "sold").length}</b> en ligne</span><span><b>${mine.filter(i => i.status === "sold").length}</b> vendus</span>${u.createdAt?.toMillis ? `<span>Inscrite ${esc(ago(u.createdAt.toMillis()))}</span>` : ""}</div>
    <div class="a-actions">
      <a class="btn small ghost" href="${esc(waLink(u.phone, "Bonjour " + u.shopName + ", ici SokoPlus."))}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn small" data-a="sub">Abonner</button>
      ${u.phoneVerified ? '<button class="btn small ghost" data-a="phone">Retirer « numéro confirmé »</button>' : '<button class="btn small ok" data-a="phone">Numéro confirmé</button>'}
      <button class="btn small ${u.certified ? "warn" : "ok"}" data-a="cert">${u.certified ? "Retirer la certification" : "Certifier"}</button>
      <button class="btn small ${u.status === "blocked" ? "ok" : "warn"}" data-a="block">${u.status === "blocked" ? "Débloquer" : "Bloquer"}</button>
    </div></article>`;
}
function usersView(q) {
  const cnt = { all: users.length, trial: 0, pro: 0, expired: 0, blocked: 0, suspect: 0, unconf: 0 };
  users.forEach(u => { cnt[userState(u)]++; const ps = phoneKind(u); if (ps !== "ok") cnt[ps]++; });
  chipsHTML([["all", "Toutes"], ["suspect", "Numéros suspects"], ["unconf", "Non confirmés"], ["trial", "Essai"], ["pro", "Abonnées"], ["expired", "Expirées"], ["blocked", "Bloquées"]], cnt);
  const list = users.filter(u => (chips.users === "all" || (chips.users === "suspect" || chips.users === "unconf" ? phoneKind(u) === chips.users : userState(u) === chips.users)) && (!q || norm(`${u.shopName} ${u.phone} ${u.email}`).includes(q)))
    .sort((a, b) => until(a) - until(b));
  return list.map(userCard).join("") || empty("shop", "Aucune boutique ne correspond.");
}

/* Modification de boutique : on affiche l'ancien et le nouveau côte à côte, puis l'admin valide ou refuse */
function reqCard(r) {
  const u = users.find(x => x.id === r.id) || {};
  const chg = (label, now, next) => next ? `<div class="a-chg"><small>${label}</small><span>${esc(now || "—")}</span><i>devient</i><b>${esc(next)}</b></div>` : "";
  return `<article class="a-card a-sub" data-row data-rid="${esc(r.id)}">
    <div class="a-top"><b>Modification de la boutique ${esc(u.shopName || "")}</b></div>
    <div class="a-meta">${lateTag(r)}${r.status === "rejected" ? '<span class="pill bad">Refusée</span>' : '<span class="pill warn">À valider</span>'} <span>${esc(u.email || "")}</span> · <span>${ago(when(r.createdAt))}</span></div>
    ${chg("Nom", u.shopName, r.shopName && r.shopName !== u.shopName ? r.shopName : "")}
    ${chg("Numéro", u.phone ? prettyPhone(u.phone) : "", r.phone && r.phone !== u.phone ? prettyPhone(r.phone) : "")}
    ${"payments" in r && r.payments !== (u.payments || "") ? `<div class="a-chg"><small>Paiements acceptés</small><span>${esc(u.payments || "—")}</span><i>devient</i><b>${esc(r.payments || "(retiré)")}</b></div>` : ""}
    ${r.logo ? `<div class="a-chg"><small>Photo de profil</small>${u.logo ? `<img src="${esc(thumb(u.logo, 120))}" alt="">` : "<span>aucune</span>"}<i>devient</i><a href="${esc(r.logo)}" target="_blank" rel="noopener"><img src="${esc(thumb(r.logo, 160))}" alt=""></a></div>` : ""}
    ${r.status === "rejected" && r.reason ? `<p class="a-desc">Motif : ${esc(r.reason)}</p>` : ""}
    <div class="a-actions">${r.status === "pending" ? '<button class="btn ok" data-a="rok">Valider</button><button class="btn ghost" data-a="rno">Refuser</button>' : '<button class="btn small ghost" data-a="rdel">Supprimer</button>'}</div>
  </article>`;
}
/* Demande de certification : l'admin voit la boutique (photo, numéro, articles, ancienneté) puis approuve ou refuse */
function certCard(r) {
  const u = users.find(x => x.id === r.id) || {}, mine = items.filter(i => i.ownerId === r.id);
  return `<article class="a-card a-sub" data-row data-cid="${esc(r.id)}">
    <div class="a-head">${av(u.shopName || "?", u.logo)}<div class="a-id"><b>${esc(u.shopName || "Boutique")} · demande de certification</b><small>${esc(u.phone ? prettyPhone(u.phone) : "")}${u.email ? " · " + esc(u.email) : ""}</small></div></div>
    <div class="a-meta">${lateTag(r)}${r.status === "rejected" ? '<span class="pill bad">Refusée</span>' : '<span class="pill warn">À valider</span>'} <span>${ago(when(r.createdAt))}</span></div>
    <div class="a-stats"><span><b>${mine.filter(i => i.status !== "sold").length}</b> en ligne</span><span><b>${mine.filter(i => i.status === "sold").length}</b> vendus</span>${u.createdAt?.toMillis ? `<span>Inscrite ${esc(ago(u.createdAt.toMillis()))}</span>` : ""}<span>${u.logo ? "Photo de profil" : "Pas de photo de profil"}</span></div>
    ${r.status === "rejected" && r.reason ? `<p class="a-desc">Motif : ${esc(r.reason)}</p>` : ""}
    <div class="a-actions">${r.status === "pending" ? '<button class="btn ok" data-a="cok">Approuver</button><button class="btn ghost" data-a="cno">Refuser</button>' : '<button class="btn small ghost" data-a="cdel">Supprimer</button>'}</div>
  </article>`;
}
/* Message dans l'espace du vendeur (affiché dans Ma boutique et dans la cloche) */
const tell = async (uid, kind, title, text) => { const r = await addDoc(collection(db, "userNotifs"), { uid, kind, title, text, read: false, createdAt: serverTimestamp() }); pingPush({ type: "user", notifId: r.id }); return r; };
async function certify(u, on) {
  await updateDoc(doc(db, "users", u.id), { certified: on });
  for (const i of items.filter(x => x.ownerId === u.id)) await updateDoc(doc(db, "items", i.id), { certified: on });   // le badge suit tous ses articles
}
async function applyProfile(r, u) {
  if (!u) throw { message: "Boutique introuvable." };
  const patch = {};
  if (r.shopName) patch.shopName = r.shopName;
  if (r.logo) patch.logo = r.logo;
  if ("payments" in r) patch.payments = r.payments || "";
  if (r.phone && r.phone !== u.phone) {   // l'index « numéro -> email » suit le nouveau numéro
    if ((await getDoc(doc(db, "phoneIndex", r.phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une autre boutique." };
    await setDoc(doc(db, "phoneIndex", r.phone), { uid: u.id, email: u.email });
    if (u.phone) await deleteDoc(doc(db, "phoneIndex", u.phone)).catch(() => { });
    patch.phone = r.phone; patch.phoneVerified = false;
  }
  await updateDoc(doc(db, "users", u.id), patch);
  const mineSnap = await getDocs(query(collection(db, "items"), where("ownerId", "==", u.id)));   // les articles déjà en ligne suivent
  await Promise.all(mineSnap.docs.map(d => updateDoc(d.ref, {
    shopName: patch.shopName ?? d.data().shopName, phone: patch.phone ?? d.data().phone, shopLogo: patch.logo ?? d.data().shopLogo ?? "", shopPay: patch.payments ?? d.data().shopPay ?? ""
  })));
  await deleteDoc(doc(db, "profileRequests", r.id));
}

function subCard(s) {
  const imgs = (s.images || []).map(u => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer"><img src="${esc(thumb(u, 360))}" alt="" loading="lazy"></a>`).join("");
  return `<article class="a-card a-sub" data-row data-sid="${esc(s.id)}">
    <div class="a-gal">${imgs}</div>
    <div class="a-top"><b>${esc(s.title)}</b><span class="a-price">${money(s.price, s.currency)}</span></div>
    <div class="a-meta">${lateTag(s)}${s.status === "rejected" ? '<span class="pill bad">Refusé</span>' : '<span class="pill warn">À valider</span>'}${s.replaces ? ' <span class="pill ok">Modification d\'un article en ligne</span>' : ""} <span>${esc(s.shopName)}</span> · <span>${esc(s.category)}</span> · <span>${esc(s.city ? s.city + ", " + s.address : s.address)}</span> · <span>${ago(when(s.createdAt))}</span></div>
    ${s.description ? `<p class="a-desc">${esc(s.description)}</p>` : ""}
    ${s.status === "rejected" && s.reason ? `<p class="a-desc">Motif : ${esc(s.reason)}</p>` : ""}
    <div class="a-actions">${s.status === "pending" ? '<button class="btn ok" data-a="ok">Valider et publier</button><button class="btn ghost" data-a="no">Refuser</button>' : '<button class="btn small ghost" data-a="delsub">Supprimer</button>'}</div>
  </article>`;
}
function reviewCard(r) {
  const shop = users.find(x => x.id === r.shopId);
  return `<article class="a-card" data-row data-rid="${esc(r.id)}">
    <div class="a-top"><b>${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)} · ${esc(items.find(i => i.id === r.itemId)?.title || "Article")} <small>(${esc(shop?.shopName || "Boutique")})</small></b></div>
    <div class="a-meta">${lateTag(r)}${r.status === "rejected" ? '<span class="pill bad">Refusé</span>' : r.status === "approved" ? '<span class="pill ok">Publié</span>' : '<span class="pill warn">Avis à valider</span>'} <span>${esc(r.buyerName || "Client")}</span> · <span>${ago(when(r.createdAt))}</span></div>
    ${r.text ? `<p class="a-desc">${esc(r.text)}</p>` : '<p class="a-desc">(sans commentaire)</p>'}
    <div class="a-actions">${r.status === "pending" ? '<button class="btn ok" data-a="rvok">Valider</button><button class="btn ghost" data-a="rvno">Refuser</button>' : '<button class="btn small ghost" data-a="rvdel">Supprimer</button>'}</div>
  </article>`;
}
function pendingView(q) {
  if (chips.pending === "pub") { const l = pubRevs.filter(r => !q || norm(`${r.buyerName} ${r.text} ${items.find(i => i.id === r.itemId)?.title || ""}`).includes(q)); return l.map(reviewCard).join("") || empty("clock", "Aucun avis publié."); }
  const base = subs.filter(s => s.status !== "approved");
  chipsHTML([["wait", "En attente"], ["rej", "Refusés"], ["pub", "Avis publiés"]], { pub: pubRevs.length, wait: base.filter(s => s.status === "pending").length + reqs.filter(r => r.status === "pending").length + creqs.filter(r => r.status === "pending").length + revs.filter(r => r.status === "pending").length, rej: base.filter(s => s.status === "rejected").length + reqs.filter(r => r.status === "rejected").length + creqs.filter(r => r.status === "rejected").length + revs.filter(r => r.status === "rejected").length });
  const list = base.filter(s => (chips.pending === "wait" ? s.status === "pending" : s.status === "rejected") && (!q || norm(`${s.title} ${s.shopName} ${s.category}`).includes(q)));
  const rl = reqs.filter(r => (chips.pending === "wait" ? r.status === "pending" : r.status === "rejected") && (!q || norm(`${users.find(x => x.id === r.id)?.shopName || ""} ${r.shopName || ""}`).includes(q)));
  const cl = creqs.filter(r => (chips.pending === "wait" ? r.status === "pending" : r.status === "rejected") && (!q || norm(users.find(x => x.id === r.id)?.shopName || "").includes(q)));
  const rv = revs.filter(r => (chips.pending === "wait" ? r.status === "pending" : r.status === "rejected") && (!q || norm(`${r.buyerName} ${r.text} ${users.find(x => x.id === r.shopId)?.shopName || ""}`).includes(q)));
  const nLate = chips.pending === "wait" ? [...subs, ...reqs, ...creqs, ...revs].filter(late).length : 0;
  const warn = nLate ? `<div class="a-late" role="status"><b>${nLate} en attente depuis plus de 24 h.</b> Les vendeurs attendent ta réponse.</div>` : "";
  return (warn + cl.map(certCard).join("") + rl.map(reqCard).join("") + rv.map(reviewCard).join("") + list.map(subCard).join("")) || empty("clock", chips.pending === "wait" ? "Rien à valider pour le moment. Tout est à jour." : "Aucun article refusé.");
}

function itemCard(i) {
  const img = i.images?.[0] ? `<img src="${esc(thumb(i.images[0], 160))}" alt="" loading="lazy">` : `<span>${esc((i.title || "?")[0])}</span>`;
  return `<article class="a-card a-item" data-row data-iid="${esc(i.id)}">
    <div class="a-pic" style="background:${tileColor(i.shopName)}">${img}</div>
    <div class="a-info"><b>${esc(i.title)}</b><small>${esc(i.shopName)} · ${money(i.price, i.currency)} · ${ago(when(i.createdAt))}</small>
      <div class="a-eye">${eyeHTML(viewsMap.get(i.id) || 0)}</div>
      <div>${i.featured ? '<span class="pill warn">À la une</span> ' : ""}${i.status === "sold" ? '<span class="pill bad">Vendu</span>' : '<span class="pill ok">En ligne</span>'}</div></div>
    <div class="a-actions"><a class="btn small ghost" href="./?item=${encodeURIComponent(i.id)}" target="_blank" rel="noopener">Voir</a>
      <button class="btn small ghost" data-a="feat">${i.featured ? "Retirer de la une" : "Mettre à la une"}</button>
      <button class="btn small ghost" data-a="del">Supprimer</button></div></article>`;
}
function itemsView(q) {
  const cnt = { all: items.length, live: items.filter(i => i.status !== "sold").length, sold: items.filter(i => i.status === "sold").length, feat: items.filter(i => i.featured).length };
  chipsHTML([["all", "Tous"], ["live", "En ligne"], ["sold", "Vendus"], ["feat", "À la une"]], cnt);
  const ok = i => ({ all: true, live: i.status !== "sold", sold: i.status === "sold", feat: !!i.featured })[chips.items];
  const list = items.filter(i => ok(i) && (!q || norm(`${i.title} ${i.shopName} ${i.category}`).includes(q)));
  return list.map(itemCard).join("") || empty("tag", "Aucun article ne correspond.");
}

function reportsView(q) {
  $("#aChips").innerHTML = "";
  const list = reports.filter(r => !q || norm(r.reason).includes(q));
  return list.map(r => {
    const it = items.find(i => i.id === r.itemId);
    return `<article class="a-card" data-row data-rid="${esc(r.id)}" data-iid="${esc(r.itemId)}">
      <div class="a-top"><b>${esc(r.reason)}</b></div>
      <div class="a-meta">${it ? esc(it.title) + " · " + esc(it.shopName) : "Article déjà supprimé"} · ${ago(when(r.createdAt))}</div>
      <div class="a-actions">${it ? `<a class="btn small ghost" href="./?item=${encodeURIComponent(r.itemId)}" target="_blank" rel="noopener">Voir</a><button class="btn small warn" data-a="delitem">Supprimer l'article</button>` : ""}
        <button class="btn small ghost" data-a="dismiss">Ignorer le signalement</button></div></article>`;
  }).join("") || empty("bell", "Aucun signalement. La communauté est calme.");
}

const TITLES = {
  home: ["Tableau de bord", "Vue d'ensemble de votre plateforme"],
  pending: ["À valider", "Articles, avis, certifications et modifications en attente"],
  users: ["Boutiques", "Abonnements, certifications et blocages"],
  items: ["Articles", "Tout ce qui est en ligne sur SokoPlus"],
  reports: ["Signalements", "Ce que la communauté t'a signalé"],
  ann: ["Annonces", "Communiqués affichés en haut de l'accueil, avec le nombre de vues"],
  price: ["Tarifs", "Prix de l'abonnement, prix barré et message aux vendeurs"]
};
/* ---------- Annonces : liste, publication (fenêtre), suppression, vues ---------- */
const annLeft = a => { const e = a.expiresAt?.toMillis?.(); return e ? e - Date.now() : null; };
function annCard(a) {
  const img = a.images?.[0] ? `<img src="${esc(thumb(a.images[0], 200))}" alt="" loading="lazy">` : `<span>${icon("mega")}</span>`;
  const left = annLeft(a), k = KINDS[a.kind] ? a.kind : "annonce";
  const state = left === null ? '<span class="pill ok">Visible sans limite</span>' : left <= 0 ? '<span class="pill bad">Terminée</span>' : `<span class="pill ok">Visible encore ${esc(fmtD(left))}</span>`;
  return `<article class="a-card a-item a-ann" data-row data-nid="${esc(a.id)}">
    <div class="a-pic" style="background:var(--soft)">${img}</div>
    <div class="a-info"><b>${esc(a.title)}</b><small>${esc(KINDS[k])} · ${ago(when(a.createdAt))}${a.images?.length ? ` · ${a.images.length} image${a.images.length > 1 ? "s" : ""}` : ""}</small>
      <div>${state} ${eyeHTML(a.views || 0)}</div></div>
    <div class="a-actions"><a class="btn small ghost" href="./?annonce=${encodeURIComponent(a.id)}" target="_blank" rel="noopener">Voir</a>
      <button class="btn small ghost" data-a="anedit">Modifier</button>
      <button class="btn small ghost" data-a="andel">Supprimer</button></div></article>`;
}
function annView(q) {
  $("#aChips").innerHTML = '<button class="btn small" type="button" id="anNew">+ Nouvelle annonce</button>';
  const total = anns.reduce((t, a) => t + (a.views || 0), 0);
  const head = anns.length ? `<p class="a-desc">${anns.length} annonce${anns.length > 1 ? "s" : ""} · ${eyeHTML(total)} au total</p>` : "";
  const list = anns.filter(a => !q || norm(`${a.title} ${a.text}`).includes(q));
  return head + (list.map(annCard).join("") || empty("mega", "Aucune annonce pour le moment. Touche « Nouvelle annonce » pour en publier une."));
}
/* ---------- Ambiance de fêtes : Automatique / Activée / Désactivée (seul l'admin décide pour tout le site) ---------- */
let festive = "auto";
const FEST = { auto: "Automatique (5 déc. au 10 janv.)", on: "Activée (chacun peut la couper)", off: "Désactivée pour tout le monde" };
function paintFest() {
  const t = $("#festS"); if (!t) return; t.textContent = FEST[festive];
  $$("#festSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === festive)));
  $("#festBox").classList.toggle("on", festive === "on");
}
paintFest();
$("#festSeg").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b || b.dataset.v === festive) return;
  const v = b.dataset.v; b.disabled = true;
  setDoc(doc(db, "config", "theme"), { festive: v, updatedAt: serverTimestamp() })
    .then(() => toast(v === "on" ? "Ambiance de fêtes activée. Chaque visiteur peut la couper dans Paramètres." : v === "off" ? "Ambiance de fêtes désactivée pour tout le monde." : "Ambiance de fêtes en mode automatique : du 5 décembre au 10 janvier."))
    .catch(err => toast(isNetErr(err) ? NET_MSG : failText(err))).finally(() => { b.disabled = false; });
});

/* ---------- Tarifs : prix actuel, prix barré, message aux vendeurs ---------- */
let pricingDoc = null, prFile = null, prRemove = false;
const DEF_PRICE = { price: 5, currency: "USD", per: "par mois" };
const prNum = v => { const n = Number(String(v).replace(",", ".")); return isFinite(n) && n > 0 ? n : 0; };
const prDraft = () => ({ price: prNum($("#prNow").value), currency: $("#prCur").value, per: $("#prPer").value, oldPrice: prNum($("#prOld").value) || null, endsAt: $("#prEnd").value ? Date.parse($("#prEnd").value + "T23:59:59") : null });
const prBase = () => ({ ...DEF_PRICE, ...(pricingDoc || {}) });
function priceView() {
  $("#aChips").innerHTML = "";
  return `<div id="pricePane" class="pr-pane">
    <section class="pr-card"><h3>Tarif de l'abonnement</h3>
      <div class="pr-row"><label class="field">Prix actuel<input id="prNow" type="number" inputmode="decimal" min="0" step="0.01"></label>
        <label class="field">Devise<select id="prCur"><option value="USD">$ (dollar)</option><option value="FC">FC (franc)</option></select></label></div>
      <label class="field">Période affichée<select id="prPer"><option>par mois</option><option>par trimestre</option><option>par an</option></select></label>
      <label class="field"><span>Ancien prix barré <span class="an-opt">· facultatif, pour une promo</span></span><input id="prOld" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Laisse vide pour un prix fixe"></label>
      <label class="field"><span>Promo valable jusqu'au <span class="an-opt">· facultatif</span></span><input id="prEnd" type="date"></label>
    </section>
    <section class="pr-card"><h3>Image du tarif <span class="an-opt">· facultatif</span></h3>
      <p class="an-sub">Une affiche ou une capture que les vendeurs verront avec le prix, et dans l'annonce si tu en publies une.</p>
      <input id="prFile" type="file" accept="image/*" hidden>
      <div id="prPic" class="pr-pic"></div>
      <div class="pr-picbtns"><button type="button" class="btn small ghost" id="prPick">Choisir une image</button><button type="button" class="btn small ghost" id="prDrop" hidden>Retirer</button></div>
    </section>
    <section class="pr-card pr-prev"><small>Aperçu côté vendeur</small><div id="prPrev" class="pr-big"></div><p id="prDelta" class="pr-delta"></p></section>
    <section class="pr-card"><h3>Prévenir les vendeurs</h3>
      <label class="pr-chk"><input type="checkbox" id="prNotify" checked><span>Afficher un avis « Nouveau tarif » dans leur espace vendeur</span></label>
      <label class="pr-chk"><input type="checkbox" id="prAnn"><span>Publier aussi une annonce sur l'accueil</span></label>
      <button type="button" class="btn small ghost" id="prNoteOff" hidden>Retirer l'avis « Nouveau tarif » chez les vendeurs</button>
      <label class="field" id="prMsgW" hidden>Message de l'annonce<textarea id="prMsg" rows="4" maxlength="600"></textarea></label>
    </section>
    <p class="msg" id="prSay" hidden></p>
    <div class="an-actions"><button class="btn" type="button" id="prSave">Enregistrer le tarif</button><button class="btn ghost" type="button" id="prReset">Rétablir</button></div>
  </div>`;
}
function prPicPaint() {
  const box = $("#prPic"); if (!box) return;
  const url = prFile ? URL.createObjectURL(prFile) : (!prRemove && pricingDoc?.image) || "";
  box.innerHTML = url ? `<img src="${esc(url)}" alt="Image du tarif">` : '<span>Aucune image</span>';
  $("#prDrop").hidden = !url; $("#prPick").textContent = url ? "Changer l'image" : "Choisir une image";
}
function prFill() {
  const d = prBase(), pane = $("#pricePane"); if (!pane) return;
  prFile = null; prRemove = false; prPicPaint();
  $("#prNow").value = d.price ?? ""; $("#prCur").value = d.currency || "USD"; $("#prPer").value = d.per || "par mois";
  $("#prOld").value = d.oldPrice ?? "";
  $("#prNotify").checked = pricingDoc ? pricingDoc.notify !== false : true;   // reflète l'état réel enregistré
  $("#prNoteOff").hidden = !(pricingDoc && pricingDoc.notify);               // bouton visible seulement si un avis est encore affiché
  const e = d.endsAt?.toMillis?.() ?? d.endsAt; $("#prEnd").value = e ? new Date(e).toISOString().slice(0, 10) : "";
  delete pane.dataset.dirty; $("#prMsg").dataset.dirty = ""; prPaint();
}
function prTexts(d) {
  const b = prBase(), prev = pricingDoc ? b.price : DEF_PRICE.price, was = fmtMoney(prev, b.currency), now = fmtMoney(d.price, d.currency);
  const until = struck(d) && d.endsAt ? ` Offre valable jusqu'au ${new Date(d.endsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.` : "";
  if (struck(d)) return { title: "Promo sur l'abonnement SokoPlus", text: `Bonne nouvelle : l'abonnement passe de ${fmtMoney(d.oldPrice, d.currency)} à ${now} ${d.per}.${until}` };
  if (d.price < prev) return { title: "Le prix de l'abonnement baisse", text: `Bonne nouvelle : l'abonnement SokoPlus passe de ${was} à ${now} ${d.per}.` };
  if (d.price > prev) return { title: "Changement du prix de l'abonnement", text: `Le prix de l'abonnement SokoPlus passe de ${was} à ${now} ${d.per}.` };
  return { title: "Tarif de l'abonnement SokoPlus", text: `L'abonnement SokoPlus est à ${now} ${d.per}.` };
}
function prPaint() {
  const d = prDraft(), b = prBase(), prev = pricingDoc ? b.price : DEF_PRICE.price;
  $("#prPrev").innerHTML = d.price ? priceHtml(d) : "—";
  let t = "";
  if (d.price && pricingDoc !== null || d.price) t = d.price > prev ? `Hausse : ${fmtMoney(prev, b.currency)} → ${fmtMoney(d.price, d.currency)} (+${Math.round((d.price / prev - 1) * 100)} %)` : d.price < prev ? `Baisse : ${fmtMoney(prev, b.currency)} → ${fmtMoney(d.price, d.currency)} (−${Math.round((1 - d.price / prev) * 100)} %)` : "Prix inchangé";
  if (d.oldPrice && !struck(d)) t += (t ? " · " : "") + "L'ancien prix doit être plus haut que le prix actuel pour être barré.";
  $("#prDelta").textContent = t;
  const w = $("#prMsgW"); w.hidden = !$("#prAnn").checked;
  if (!w.hidden && !$("#prMsg").dataset.dirty && d.price) $("#prMsg").value = prTexts(d).text;
}
document.addEventListener("input", e => {
  const pane = e.target.closest("#pricePane"); if (!pane) return;
  if (e.target.id === "prMsg") e.target.dataset.dirty = "1"; else pane.dataset.dirty = "1";
  prPaint();
});
document.addEventListener("change", e => {
  if (e.target.id === "prFile") { const f = e.target.files[0]; e.target.value = ""; if (f && f.type.startsWith("image/")) { prFile = f; prRemove = false; $("#pricePane").dataset.dirty = "1"; prPicPaint(); } return; }
  if (e.target.closest("#pricePane")) prPaint();
});
document.addEventListener("click", ev => {
  if (ev.target.closest("#prReset")) return prFill();
  if (ev.target.closest("#prNoteOff")) {
    if (!window.confirm("Retirer l'avis « Nouveau tarif » ? Il disparaît tout de suite de l'espace de tous les vendeurs. Le prix, lui, ne change pas.")) return;
    return run(btnOf(ev), async () => { await updateDoc(doc(db, "config", "pricing"), { notify: false }); }, { busy: "Retrait…", done: "Avis retiré", hold: 700 })
      .then(() => { $("#prNoteOff").hidden = true; $("#prNotify").checked = false; toast("Avis retiré : il disparaît de l'espace des vendeurs."); })
      .catch(err => toast(isNetErr(err) ? NET_MSG : failText(err)));
  }
  if (ev.target.closest("#prPick")) return $("#prFile").click();
  if (ev.target.closest("#prDrop")) { prFile = null; prRemove = true; $("#pricePane").dataset.dirty = "1"; return prPicPaint(); }
  const bt = ev.target.closest("#prSave"); if (!bt) return;
  const say = (t, k = "") => { const m = $("#prSay"); m.hidden = !t; m.className = "msg " + k; m.textContent = t || ""; };
  const d = prDraft(); if (!d.price) return say("Entre un prix supérieur à 0.", "warn");
  if (d.oldPrice && !struck(d)) return say("L'ancien prix doit être plus haut que le prix actuel pour être barré.", "warn");
  const b = prBase(), prev = pricingDoc ? b.price : DEF_PRICE.price, tx = prTexts(d), ann = $("#prAnn").checked, msg = $("#prMsg").value.trim();
  if (ann && msg.length < 5) return say("Écris le message de l'annonce.", "warn");
  run(btnOf(ev), async () => {
    let image = pricingDoc?.image || null;
    if (prFile) { say("Envoi de l'image…"); image = await uploadImage(await compress(prFile, 1400)); } else if (prRemove) image = null;
    const data = { image, price: d.price, currency: d.currency, per: d.per, oldPrice: d.oldPrice, endsAt: d.endsAt ? Timestamp.fromMillis(d.endsAt) : null, prev: d.price !== prev ? prev : (pricingDoc?.prev ?? null), notify: $("#prNotify").checked, version: Date.now(), updatedAt: serverTimestamp() };
    data.text = priceText(data);
    await setDoc(doc(db, "config", "pricing"), data);
    if (ann) await addDoc(collection(db, "announcements"), { kind: "communique", title: tx.title, text: msg, images: image ? [image] : [], views: 0, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * DAY) });
  }, { busy: "Enregistrement…", done: "Enregistré", hold: 700 }).then(() => { say(""); toast(ann ? "Tarif enregistré et annonce publiée." : "Tarif enregistré. Les vendeurs le voient tout de suite."); $("#prAnn").checked = false; prFill(); })
    .catch(err => say(isNetErr(err) ? NET_MSG : failText(err), "err"));
});

const ad = $("#annDlg"); let anItems = [], anEditId = null, anRepl = -1;   // anItems : images gardées ({ url }) et nouvelles ({ file }), dans l'ordre d'affichage
const anSrc = it => it.url ? thumb(it.url, 200) : (it.src ||= URL.createObjectURL(it.file));
function anPaint() {
  $("#anPics").innerHTML = anItems.map((it, n) => `<span class="an-pic"><img src="${esc(anSrc(it))}" alt=""><button type="button" data-rm="${n}" aria-label="Retirer l'image">×</button><button type="button" class="an-rp" data-rp="${n}" aria-label="Remplacer cette image">↻</button>${n ? `<button type="button" class="an-up" data-up="${n}" aria-label="Avancer d'une place">◀</button>` : '<em class="an-first">1re</em>'}</span>`).join("");
  $("#anAdd").hidden = anItems.length >= 4;
}
const anSeg = () => { for (const [g, sel] of [["#anKinds", "#anKind"], ["#anLifes", "#anLife"]]) $$(g + " button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === $(sel).value))); };
document.addEventListener("click", e => { const b = e.target.closest("#anKinds button, #anLifes button"); if (!b) return; $(b.closest("#anKinds") ? "#anKind" : "#anLife").value = b.dataset.v; anSeg(); });
function anOpen(a = null) {   // sans argument : nouvelle annonce ; avec une annonce : on la modifie
  anEditId = a ? a.id : null; anRepl = -1;
  anItems = (a?.images || []).map(url => ({ url }));
  $("#anKind").value = a ? (KINDS[a.kind] ? a.kind : "annonce") : "annonce";
  $("#anTitle").value = a ? a.title || "" : ""; $("#anText").value = a ? a.text || "" : "";
  $("#anLife").value = a ? "keep" : "30"; $("#anLifeKeep").hidden = !a;
  $("#anMsg").hidden = true; $("#anFiles").value = "";
  $("#anH").textContent = a ? "Modifier l'annonce" : "Nouvelle annonce";
  $("#anSend").textContent = a ? "Enregistrer les modifications" : "Publier l'annonce";
  anPaint(); anSeg(); ad.showModal();
}
document.addEventListener("click", e => { if (e.target.closest("#anNew")) anOpen(); });
ad.addEventListener("click", e => {
  if (e.target === ad || e.target.closest("[data-close]")) return ad.close();
  if (e.target.closest("#anAdd")) { anRepl = -1; $("#anFiles").multiple = true; return $("#anFiles").click(); }
  const r = e.target.closest("[data-rm]"); if (r) { anItems.splice(Number(r.dataset.rm), 1); return anPaint(); }
  const rp = e.target.closest("[data-rp]"); if (rp) { anRepl = Number(rp.dataset.rp); $("#anFiles").multiple = false; return $("#anFiles").click(); }
  const up = e.target.closest("[data-up]"); if (up) { const n = Number(up.dataset.up); [anItems[n - 1], anItems[n]] = [anItems[n], anItems[n - 1]]; anPaint(); }
});
$("#anFiles").addEventListener("change", e => {
  const fs = [...e.target.files].filter(f => f.type.startsWith("image/")); e.target.value = "";
  if (anRepl >= 0 && fs[0]) anItems[anRepl] = { file: fs[0] };   // remplace l'image touchée, à la même place
  else anItems = [...anItems, ...fs.map(file => ({ file }))].slice(0, 4);
  anRepl = -1; anPaint();
});
$("#anSend").addEventListener("click", ev => {
  const m = $("#anMsg"), say = (t, k = "") => { m.hidden = !t; m.className = "msg " + k; m.textContent = t || ""; };
  const title = $("#anTitle").value.trim().replace(/\s+/g, " "), text = $("#anText").value.trim(), editing = anEditId;
  if (title.length < 2) return say("Écris un titre (au moins 2 lettres).", "warn");
  if (!text && !anItems.length) return say("Ajoute un message ou au moins une image.", "warn");
  run(btnOf(ev), async () => {
    if (anItems.some(i => i.file)) say("Envoi des images…");
    const images = [];
    for (const it of anItems) images.push(it.url || await uploadImage(await compress(it.file, 1400)));
    say(editing ? "Enregistrement…" : "Publication…");
    const life = $("#anLife").value, days = life === "keep" ? 0 : Number(life);
    if (editing) {
      const upd = { kind: $("#anKind").value, title, text, images, editedAt: serverTimestamp() };
      if (life !== "keep") upd.expiresAt = days ? Timestamp.fromMillis(Date.now() + days * DAY) : deleteField();
      await updateDoc(doc(db, "announcements", editing), upd);
    } else {
      const data = { kind: $("#anKind").value, title, text, images, views: 0, createdAt: serverTimestamp() };
      if (days) data.expiresAt = Timestamp.fromMillis(Date.now() + days * DAY);
      await addDoc(collection(db, "announcements"), data);
    }
    return editing;
  }, { busy: "Enregistrement…", done: "Enregistré", hold: 700 }).then(editing => { say(""); ad.close(); toast(editing ? "Annonce modifiée : les changements sont déjà visibles sur l'accueil." : "Annonce publiée : elle apparaît déjà sur l'accueil."); }).catch(err => say(isNetErr(err) ? NET_MSG : failText(err), "err"));
});
async function loadViews() {
  try { const s = await getDocs(query(collection(db, "itemViews"), limit(1000))); viewsMap = new Map(s.docs.map(d => [d.id, Number(d.data().n) || 0])); if (tab === "items") render(); } catch { /* compteurs indisponibles : on affiche 0 */ }
}

function render() {
  const now = Date.now(), waiting = subs.filter(s => s.status === "pending").length + reqs.filter(r => r.status === "pending").length + creqs.filter(r => r.status === "pending").length + revs.filter(r => r.status === "pending").length;
  $("#aWho").textContent = auth.currentUser?.email || "";
  $("#pCount").textContent = waiting; $("#pCount").hidden = !waiting;
  $("#uCount").textContent = users.length; $("#iCount").textContent = items.length;
  $("#aCount").textContent = anns.length; $("#rCount").textContent = reports.length; $("#rCount").hidden = !reports.length;
  const bn = waiting + reports.length; $("#bellN").hidden = !bn; $("#bellN").textContent = bn > 9 ? "9+" : bn;
  document.title = (waiting ? `(${waiting}) ` : "") + "Administration – SokoPlus";
  $$("[data-t]").forEach(b => b.setAttribute("aria-selected", b.dataset.t === tab));
  $("#adTitle").textContent = TITLES[tab][0]; $("#adSub").textContent = TITLES[tab][1];
  const home = tab === "home";
  $("#homeView").hidden = !home; $("#listView").hidden = home;
  $("#aSearch").placeholder = { home: "Rechercher une boutique, un article…", pending: "Chercher un article ou une boutique", users: "Chercher une boutique, un numéro, un e-mail", items: "Chercher un article", reports: "Chercher un signalement", price: "Pas de recherche ici", ann: "Chercher une annonce" }[tab];
  if (home) { $("#homeView").innerHTML = homeHTML({ users, items, subs, creqs, reports, revs, buyers, range, av, state: userState, waiting }); return; }
  const list = $("#list");
  list.classList.toggle("a-in", fxNext); fxNext = false;
  if (tab === "price" && $("#pricePane")) { if (!$("#pricePane").dataset.dirty) prFill(); return; }   // on ne réécrit pas le formulaire pendant que tu tapes
  list.innerHTML = { pending: pendingView, users: usersView, items: itemsView, reports: reportsView, ann: annView, price: priceView }[tab](norm($("#aSearch").value.trim()));
  if (tab === "price") prFill();
}

/* Minuteurs des boutiques : le temps restant défile chaque seconde */
setInterval(() => {
  $$("[data-until]").some(el => {
    const end = Number(el.dataset.until), ms = end - Date.now();
    if (ms <= 0) { render(); return true; }
    el.textContent = `${fmtD(ms)} restants, jusqu'au ${dateFr(end)}`; return false;
  });
}, 1000);

$$("[data-ic]").forEach(el => { el.innerHTML = icon(el.dataset.ic); });
const go = t => { if (t === "items") loadViews(); tab = t; fxNext = true; document.body.classList.remove("ad-open"); render(); scrollTo({ top: 0 }); };
$$("[data-t]").forEach(b => b.onclick = () => go(b.dataset.t));
$("#aSearch").addEventListener("input", () => {
  const q = norm($("#aSearch").value.trim());
  if (tab === "home" && q) go(users.some(u => norm(`${u.shopName} ${u.phone} ${u.email}`).includes(q)) ? "users" : "items");   // la recherche du haut ouvre la bonne liste
  else render();
});
$("#adBell").onclick = () => go(creqs.length + subs.filter(s => s.status === "pending").length + revs.length + reqs.length || !reports.length ? "pending" : "reports");
$("#adMenu").onclick = $("#adMore").onclick = () => document.body.classList.toggle("ad-open");
$("#adScrim").onclick = () => document.body.classList.remove("ad-open");
$("#maintBtn").addEventListener("click", () => document.body.classList.remove("ad-open"));
const hv = $("#homeView");
hv.addEventListener("click", e => {
  const g = e.target.closest("[data-go]"), r = e.target.closest("[data-r]");
  if (g) go(g.dataset.go);
  if (r) { range = Number(r.dataset.r); render(); }
});
hv.addEventListener("pointermove", chartTip); hv.addEventListener("pointerdown", chartTip);
hv.addEventListener("pointerout", e => { const c = e.target.closest?.("[data-chart]"); if (c && !e.relatedTarget?.closest?.("[data-chart]")) { c.querySelector(".ad-tip").hidden = true; c.querySelector(".ad-hov").hidden = true; } });
$("#aChips").addEventListener("click", e => { const c = e.target.closest("[data-c]"); if (!c) return; chips[tab] = c.dataset.c; fxNext = true; render(); });

/* Abonnement : fenêtre tactile (raccourcis + boutons + / −), plus besoin de saisir jours/heures/minutes */
const sd = $("#subDlg"), sv = { m: 0, d: 0, h: 0, n: 0, s: 0 }, maxOf = { m: 60, d: 365, h: 23, n: 59, s: 59 };
let subUser = null, subMode = "add";
const subBase = () => subMode === "add" ? Math.max(Date.now(), until(subUser)) : Date.now();
function subEnd() {
  const dt = new Date(subBase()); dt.setMonth(dt.getMonth() + sv.m);
  return dt.getTime() + sv.d * DAY + sv.h * 36e5 + sv.n * 6e4 + sv.s * 1e3;
}
function subPaint() {
  const tot = sv.m + sv.d + sv.h + sv.n + sv.s, end = subEnd();
  $$("#subDlg [data-k]").forEach(el => { el.value = sv[el.dataset.k]; });
  $$("#subDlg [data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === subMode));
  $$("#subDlg [data-pre]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pre === JSON.stringify(sv)));
  const parts = [sv.m && `${sv.m} mois`, sv.d && `${sv.d} j`, sv.h && `${sv.h} h`, sv.n && `${sv.n} min`, sv.s && `${sv.s} s`].filter(Boolean);
  $("#subSum").innerHTML = tot ? `<small>Remplace l'ancien abonnement, à partir de maintenant : ${esc(parts.join(" "))}</small><b>Fin le ${esc(new Date(end).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</b>` : `<small>Choisis une durée ci-dessus</small>`;
  $("#subOk").disabled = !tot;
}
function openSub(u) {
  if (!u) return;
  subUser = u; subMode = "reset"; Object.assign(sv, { m: 1, d: 0, h: 0, n: 0, s: 0 });
  $("#subWho").textContent = u.shopName;
  $("#subNow").textContent = left(u) > 0 ? `Il reste ${fmtD(left(u))} (jusqu'au ${dateFr(until(u))}).` : "Aucun abonnement en cours.";
  subPaint(); sd.showModal();
}
const subPresets = { "1 semaine": { m: 0, d: 7, h: 0, n: 0, s: 0 }, "1 mois": { m: 1, d: 0, h: 0, n: 0, s: 0 }, "3 mois": { m: 3, d: 0, h: 0, n: 0, s: 0 }, "6 mois": { m: 6, d: 0, h: 0, n: 0, s: 0 }, "1 an": { m: 12, d: 0, h: 0, n: 0, s: 0 } };
$("#subPre").innerHTML = Object.entries(subPresets).map(([l, v]) => `<button type="button" class="a-chip" data-pre='${JSON.stringify(v)}'>${l}</button>`).join("");
sd.addEventListener("click", e => {
  if (e.target === sd || e.target.closest("[data-close]")) return sd.close();
  const pre = e.target.closest("[data-pre]"), st = e.target.closest("[data-step]"), md = e.target.closest("[data-mode]");
  if (pre) Object.assign(sv, JSON.parse(pre.dataset.pre));
  if (st) { const k = st.dataset.k, v = sv[k] + Number(st.dataset.step); sv[k] = Math.min(maxOf[k], Math.max(0, v)); }
  if (md) subMode = md.dataset.mode;
  if (pre || st || md) subPaint();
});
sd.addEventListener("input", e => {
  const k = e.target.dataset.k; if (!k) return;
  sv[k] = Math.min(maxOf[k], Math.max(0, Math.floor(Number(e.target.value) || 0))); subPaint();
});
$("#subOk").onclick = async e => {
  const u = subUser, end = subEnd();
  try {
    await run(e.currentTarget, () => updateDoc(doc(db, "users", u.id), { activeUntil: Timestamp.fromMillis(end), status: "active", plan: "pro" }), { busy: "Activation…", done: "Activé", hold: 700 });
    sd.close(); toast(`${u.shopName} : abonnement actif jusqu'au ${dateFr(end)}.`);
  } catch (err) { toast("Échec : " + failText(err)); }
};

/* Mode maintenance : bloque tout le site (sauf l'admin) avec message et minuteur jusqu'à l'heure de fin */
const md = $("#maintDlg"), mv = { d: 0, h: 1, n: 0 }, mMax = { d: 30, h: 23, n: 59 };
const mOn = () => !!(maint?.on && (maint.until?.toMillis?.() ?? 0) > Date.now());
const mEnd = () => maint?.until?.toMillis?.() ?? 0;
const mDur = () => mv.d * DAY + mv.h * 36e5 + mv.n * 6e4;
const longDate = t => new Date(t).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const DEF_MSG = "SokoPlus fait un petit entretien pour mieux te servir. On revient très vite, merci de ta patience.";
function paintMaint() {
  const on = mOn();
  $("#maintBtn").classList.toggle("on", on);
  $("#maintS").textContent = on ? `Bloqué · rouvre dans ${fmtD(mEnd() - Date.now())}` : "Site en ligne · touche pour planifier";
  if (!md.open) return;
  $("#mOff").hidden = on; $("#mOn").hidden = !on;
  if (on) { $("#mLeft").textContent = fmtD(mEnd() - Date.now()); $("#mEnd").textContent = "Retour prévu le " + longDate(mEnd()); }
  else {
    $$("#maintDlg [data-k]").forEach(el => { el.value = mv[el.dataset.k]; });
    $$("#maintDlg [data-pre]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pre === JSON.stringify(mv)));
    $("#mSum").innerHTML = mDur() ? `<small>Le site sera bloqué dès que tu confirmes</small><b>Réouverture le ${esc(longDate(Date.now() + mDur()))}</b>` : "<small>Choisis une durée</small>";
    $("#mGo").disabled = !mDur();
  }
}
setInterval(paintMaint, 1000);
const mPresets = { "30 min": { d: 0, h: 0, n: 30 }, "1 h": { d: 0, h: 1, n: 0 }, "2 h": { d: 0, h: 2, n: 0 }, "6 h": { d: 0, h: 6, n: 0 }, "12 h": { d: 0, h: 12, n: 0 }, "24 h": { d: 1, h: 0, n: 0 } };
$("#mPre").innerHTML = Object.entries(mPresets).map(([l, v]) => `<button type="button" class="a-chip" data-pre='${JSON.stringify(v)}'>${l}</button>`).join("");
$("#maintBtn").onclick = () => {
  Object.assign(mv, { d: 0, h: 1, n: 0 }); $("#mMsg").value = maint?.message || ""; resetGo();
  md.showModal(); paintMaint();
};
let goTimer = 0;
function resetGo() { clearTimeout(goTimer); const b = $("#mGo"); delete b.dataset.sure; b.textContent = "Bloquer le site"; }
md.addEventListener("click", async e => {
  if (e.target === md || e.target.closest("[data-close]")) return md.close();
  const pre = e.target.closest("[data-pre]"), st = e.target.closest("[data-step]"), ext = e.target.closest("[data-ext]");
  if (pre) Object.assign(mv, JSON.parse(pre.dataset.pre));
  if (st) { const k = st.dataset.k; mv[k] = Math.min(mMax[k], Math.max(0, mv[k] + Number(st.dataset.step))); }
  if (pre || st) { resetGo(); paintMaint(); }
  if (ext) {
    try { await run(ext, () => setDoc(doc(db, "config", "maintenance"), { on: true, until: Timestamp.fromMillis(Math.max(mEnd(), Date.now()) + Number(ext.dataset.ext) * 6e4), message: maint?.message || "", startedAt: maint?.startedAt || serverTimestamp() }), { hold: 500 }); toast("Maintenance prolongée."); }
    catch (err) { toast("Échec : " + failText(err)); }
  }
});
md.addEventListener("input", e => {
  const k = e.target.dataset.k; if (!k) return;
  mv[k] = Math.min(mMax[k], Math.max(0, Math.floor(Number(e.target.value) || 0))); resetGo(); paintMaint();
});
$("#mGo").onclick = async e => {
  const b = e.currentTarget;
  if (!b.dataset.sure) {   // double toucher : ça bloque tout le monde
    b.dataset.sure = "1"; b.textContent = "Confirmer le blocage ?";
    goTimer = setTimeout(resetGo, 4000); return;
  }
  clearTimeout(goTimer);
  try {
    await run(b, () => setDoc(doc(db, "config", "maintenance"), { on: true, until: Timestamp.fromMillis(Date.now() + mDur()), message: $("#mMsg").value.trim().slice(0, 200) || DEF_MSG, startedAt: serverTimestamp() }), { busy: "Blocage…", done: "Site bloqué", hold: 700 });
    toast("Le site est en maintenance. Il rouvrira tout seul à l'heure de fin.");
  } catch (err) { resetGo(); toast("Échec : " + failText(err)); }
};
$("#mStop").onclick = async e => {
  try {
    await run(e.currentTarget, () => setDoc(doc(db, "config", "maintenance"), { on: false, until: Timestamp.fromMillis(Date.now()), message: maint?.message || "", startedAt: maint?.startedAt || serverTimestamp() }), { busy: "Réouverture…", done: "Site rouvert", hold: 700 });
    md.close(); toast("Le site est de nouveau ouvert à tout le monde.");
  } catch (err) { toast("Échec : " + failText(err)); }
};

/* Fenêtre « motif » : le motif est obligatoire, il est envoyé au vendeur */
const REASONS = ["Contenu interdit ou illégal", "Article en double", "Photos ou description trompeuses", "Prix ou informations incorrects", "Mauvaise catégorie", "Signalé par des acheteurs"];
function askReason({ title, sub = "", ok = "Confirmer" }) {
  return new Promise(resolve => {
    const d = document.createElement("dialog"); d.className = "a-reason";
    d.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p class="rsub">${esc(sub)}</p>` : ""}
      <p class="rhint">Le vendeur recevra ce motif dans son espace et par notification.</p>
      <div class="rchips">${REASONS.map(r => `<button type="button" class="rchip">${esc(r)}</button>`).join("")}</div>
      <textarea rows="3" maxlength="200" placeholder="Écris le motif (obligatoire)"></textarea>
      <p class="rerr" hidden>Le motif est obligatoire (3 caractères minimum).</p>
      <div class="racts"><button type="button" class="btn ghost" data-c>Annuler</button><button type="button" class="btn warn" data-ok>${esc(ok)}</button></div>`;
    document.body.append(d);
    const ta = d.querySelector("textarea"), err = d.querySelector(".rerr");
    let out = null;
    d.addEventListener("click", e => {
      const chip = e.target.closest(".rchip");
      if (chip) { ta.value = chip.textContent; err.hidden = true; ta.focus(); return; }
      if (e.target.closest("[data-c]")) return d.close();
      if (e.target.closest("[data-ok]")) {
        const v = ta.value.trim().slice(0, 200);
        if (v.length < 3) { err.hidden = false; return ta.focus(); }
        out = v; d.close();
      }
    });
    d.addEventListener("close", () => { d.remove(); resolve(out); });
    d.showModal(); ta.focus();
  });
}
const onAction = async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const row = b.closest("[data-row]"), a = b.dataset.a;
  try {
    if (a === "cok" || a === "cno" || a === "cdel") {
      const r = creqs.find(x => x.id === row.dataset.cid); if (!r) return;
      const u = users.find(x => x.id === r.id);
      if (a === "cok") {
        if (!u) throw { message: "Boutique introuvable." };
        await run(b, async () => {
          await certify(u, true);
          await tell(u.id, "cert_approved", "Ta boutique est certifiée", "Bonne nouvelle : SokoPlus a approuvé ta demande. Le badge s'affiche maintenant à côté du nom de ta boutique.");
          await deleteDoc(doc(db, "certRequests", r.id));
        }, { busy: "Validation…", done: "Approuvée", hold: 700 });
        toast(`${u.shopName} est maintenant certifiée. Elle est prévenue.`);
      }
      if (a === "cno") {
        const reason = window.prompt("Motif du refus (la boutique le verra). Laisse vide si tu ne veux rien préciser.", ""); if (reason === null) return;
        const why = reason.trim().slice(0, 200);
        await run(b, async () => {
          await updateDoc(doc(db, "certRequests", r.id), { status: "rejected", reason: why });
          await tell(r.id, "cert_rejected", "Demande de certification refusée", why ? `SokoPlus n'a pas pu certifier ta boutique pour le moment. Motif : ${why}. Tu peux refaire une demande.` : "SokoPlus n'a pas pu certifier ta boutique pour le moment. Tu peux refaire une demande.");
        }, { busy: "Refus…", done: "Refusée", hold: 600 });
        toast("Demande refusée. La boutique est prévenue.");
      }
      if (a === "cdel") await deleteDoc(doc(db, "certRequests", r.id));
      return;
    }
    if (a === "rok" || a === "rno" || a === "rdel") {
      const r = reqs.find(x => x.id === row.dataset.rid); if (!r) return;
      if (a === "rok") { await run(b, () => applyProfile(r, users.find(x => x.id === r.id)), { busy: "Validation…", done: "Validé", hold: 700 }); toast("Modifications validées : la boutique et ses articles sont à jour."); }
      if (a === "rno") {
        const reason = window.prompt("Motif du refus (la boutique le verra). Laisse vide si tu ne veux rien préciser.", ""); if (reason === null) return;
        await run(b, () => updateDoc(doc(db, "profileRequests", r.id), { status: "rejected", reason: reason.trim().slice(0, 200) }), { busy: "Refus…", done: "Refusé", hold: 600 });
        toast("Demande refusée. La boutique voit le motif.");
      }
      if (a === "rdel") await deleteDoc(doc(db, "profileRequests", r.id));
      return;
    }
    if (a === "ok" || a === "no" || a === "delsub") {
      const s = subs.find(x => x.id === row.dataset.sid); if (!s) return;
      const owner = users.find(x => x.id === s.ownerId);
      if (a === "ok") {
        await run(b, async () => {
          if (s.replaces) {   // modification d'un article déjà en ligne : on vérifie que l'article appartient bien à ce vendeur
            const cur = await getDoc(doc(db, "items", s.replaces));
            if (!cur.exists() || cur.data().ownerId !== s.ownerId) throw { message: "L'article à modifier n'existe plus ou n'appartient pas à ce vendeur." };
            await updateDoc(cur.ref, { title: s.title, description: s.description, price: s.price, category: s.category, address: s.address, city: s.city || "", country: s.country || "CD", currency: s.currency || "USD", images: s.images, oldPrice: s.oldPrice || deleteField(), tag: s.tag || deleteField() });
            await deleteDoc(doc(db, "submissions", s.id));
            if (owner?.email) notify("approved", { to: owner.email, title: s.title, shopName: s.shopName });
            return;
          }
          if ((await getDoc(doc(db, "items", s.id))).exists()) throw { message: "Un article avec cet identifiant existe déjà : proposition suspecte, refuse-la." };   // empêche d'écraser l'article d'un autre vendeur
          await setDoc(doc(db, "items", s.id), {
            title: s.title, description: s.description, price: s.price, category: s.category, address: s.address, city: s.city || "", country: s.country || "CD", currency: s.currency || "USD", images: s.images,
            ownerId: s.ownerId, shopName: owner?.shopName || s.shopName, phone: owner?.phone || s.phone, shopLogo: owner?.logo || "", ...(owner?.payments ? { shopPay: owner.payments } : {}), status: "available", featured: false, createdAt: serverTimestamp(),
            ...(owner?.certified ? { certified: true } : {}), ...(s.oldPrice ? { oldPrice: s.oldPrice } : {}), ...(s.tag ? { tag: s.tag } : {})
          });
          await updateDoc(doc(db, "submissions", s.id), { status: "approved" });
          pingPush({ type: "item", itemId: s.id });
          if (owner?.email) notify("approved", { to: owner.email, title: s.title, shopName: s.shopName });
        }, { busy: "Validation…", done: "Validé", hold: 700 });
        toast("Article validé et en ligne. Le vendeur est prévenu.");
      }
      if (a === "no") {
        const reason = window.prompt("Motif du refus (le vendeur le verra). Laisse vide si tu ne veux rien préciser.", "");
        if (reason === null) return;
        await run(b, async () => {
          await updateDoc(doc(db, "submissions", s.id), { status: "rejected", reason: reason.trim().slice(0, 200) });
          if (owner?.email) notify("rejected", { to: owner.email, title: s.title, shopName: s.shopName, reason: reason.trim() });
        }, { busy: "Refus…", done: "Refusé", hold: 600 });
        toast("Article refusé. Le vendeur est prévenu.");
      }
      if (a === "delsub") await deleteDoc(doc(db, "submissions", s.id));
      return;
    }
    if (a === "sub") { openSub(users.find(x => x.id === row.dataset.uid)); return; }
    if (a === "block") {
      const u = users.find(x => x.id === row.dataset.uid);
      await updateDoc(doc(db, "users", u.id), { status: u.status === "blocked" ? "active" : "blocked" });
      toast(`${u.shopName} : boutique ${u.status === "blocked" ? "débloquée" : "bloquée"}.`);
    }
    if (a === "rvok" || a === "rvno" || a === "rvdel") {
      const r = [...revs, ...pubRevs].find(x => x.id === row.dataset.rid); if (!r) return;
      if (a === "rvdel") { if (!window.confirm("Supprimer cet avis définitivement ?")) return; await deleteDoc(doc(db, "reviews", r.id)); return; }
      await run(b, () => updateDoc(doc(db, "reviews", r.id), { status: a === "rvok" ? "approved" : "rejected" }), { busy: a === "rvok" ? "Validation…" : "Refus…", done: a === "rvok" ? "Validé" : "Refusé", hold: 600 });
      toast(a === "rvok" ? "Avis validé : il est maintenant visible." : "Avis refusé.");
      return;
    }
    if (a === "phone") {
      const u = users.find(x => x.id === row.dataset.uid); if (!u) return;
      const on = !u.phoneVerified;
      if (on && phoneIssue(String(u.phone || "")) !== "") { toast("Ce numéro est invalide : demande au vendeur de le corriger d'abord."); return; }
      if (!window.confirm(on ? `Confirmer le numéro ${prettyPhone(u.phone)} ? Vérifie d'abord que le message WhatsApp reçu vient bien de ce numéro.` : `Retirer la confirmation du numéro de « ${u.shopName} » ?`)) return;
      await run(b, () => updateDoc(doc(db, "users", u.id), { phoneVerified: on }), { busy: "Mise à jour…", done: on ? "Confirmé" : "Retiré", hold: 600 });
      if (on) await tell(u.id, "phone_ok", "Numéro confirmé", "Merci : SokoPlus a bien reçu ton message. Ton numéro WhatsApp est confirmé.").catch(() => { });
      toast(on ? `Numéro de ${u.shopName} confirmé.` : "Confirmation retirée.");
      return;
    }
    if (a === "anedit") { const n = anns.find(x => x.id === row.dataset.nid); if (n) anOpen(n); return; }
    if (a === "andel") {
      const n = anns.find(x => x.id === row.dataset.nid); if (!n) return;
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; return setTimeout(() => { delete b.dataset.sure; b.textContent = "Supprimer"; }, 3000); }
      await run(b, () => deleteDoc(doc(db, "announcements", n.id)), { busy: "Suppression…", done: "Supprimée", hold: 600 });
      toast(`Annonce « ${n.title} » supprimée.`);
      return;
    }
    if (a === "cert") {
      const u = users.find(x => x.id === row.dataset.uid); if (!u) return;
      const on = !u.certified;
      if (!window.confirm(on ? `Certifier la boutique « ${u.shopName} » ? Ses nouveaux articles seront publiés sans validation.` : `Retirer la certification de « ${u.shopName} » ? Ses articles devront à nouveau être validés.`)) return;
      await run(b, async () => {
        await certify(u, on);
        if (on && creqs.some(x => x.id === u.id)) {   // une demande était en cours : on la clôture et on prévient la boutique
          await tell(u.id, "cert_approved", "Ta boutique est certifiée", "Bonne nouvelle : SokoPlus a approuvé ta demande. Le badge s'affiche maintenant à côté du nom de ta boutique.");
          await deleteDoc(doc(db, "certRequests", u.id));
        }
      }, { busy: "Mise à jour…", done: on ? "Certifiée" : "Retirée", hold: 700 });
      toast(on ? `${u.shopName} est maintenant certifiée.` : `${u.shopName} n'est plus certifiée.`);
      return;
    }
    if (a === "feat") { const i = items.find(x => x.id === row.dataset.iid); await updateDoc(doc(db, "items", i.id), { featured: !i.featured }); }
    if (a === "del" || a === "delitem") {
      const iid = row.dataset.iid, it = items.find(x => x.id === iid);
      const why = await askReason({ title: "Supprimer cet article ?", sub: it ? `« ${it.title} » · ${it.shopName}` : "", ok: "Supprimer et prévenir" });
      if (!why) return;
      await run(b, async () => {
        if (it?.ownerId) await tell(it.ownerId, "item_removed", "Ton article a été retiré", `SokoPlus a retiré ton article « ${it.title} ». Motif : ${why}. Si tu penses que c'est une erreur, écris-nous sur WhatsApp.`);
        await deleteDoc(doc(db, "items", iid));
        if (row.dataset.rid) await deleteDoc(doc(db, "reports", row.dataset.rid));
      }, { busy: "Suppression…", done: "Supprimé", hold: 500 });
      toast(it?.ownerId ? "Article supprimé. Le vendeur a reçu le motif." : "Article supprimé.");
    }
    if (a === "dismiss") await deleteDoc(doc(db, "reports", row.dataset.rid));
  } catch (err) { toast("Échec : " + failText(err)); }
};
$("#list").addEventListener("click", onAction);
$("#homeView").addEventListener("click", onAction);
