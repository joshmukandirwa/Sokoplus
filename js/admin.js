import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  collection, query, orderBy, limit, where, getDocs, onSnapshot, Timestamp
} from "./fb.js";
import { SITE, configured, configBanner, $, $$, esc, money, prettyPhone, waLink, ago, toast, thumb, tileColor } from "./common.js";
import { icon } from "./icons.js";
import { notify } from "./notify.js";
import { run, btnOf } from "./feedback.js";
import { bindLogout } from "./logout.js";

configBanner();
const DAY = 864e5;
let maint = null, tab = "pending", users = [], items = [], reports = [], subs = [], reqs = [], unsubs = [], firstSubs = true, firstReqs = true;

const say = (t, kind = "") => { const m = $("#aMsg"); m.hidden = !t; m.className = "msg " + kind; m.textContent = t || ""; };

$("#fLogin").addEventListener("submit", e => {
  e.preventDefault(); say("On vérifie tes infos…");
  run(btnOf(e), () => signInWithEmailAndPassword(auth, $("#aMail").value.trim().toLowerCase(), $("#aPw").value), { busy: "Connexion…", done: "Bienvenue", hold: 600 })
    .catch(() => say("Email ou mot de passe incorrect.", "err"));
});
$("#aGoogle").onclick = () => {
  say("Ouverture de Google…");
  run($("#aGoogle"), () => signInWithPopup(auth, new GoogleAuthProvider()), { hold: 500 })
    .then(() => say(""))
    .catch(err => { say(["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code) ? "" : "Connexion Google impossible : " + (err.code || err.message), "err"); });
};
bindLogout($("#logout"), () => signOut(auth));

if (!configured) say("Firebase n'est pas configuré (voir README).", "warn");
else onAuthStateChanged(auth, async u => {
  unsubs.forEach(f => f()); unsubs = [];
  if (!u) { $("#login").hidden = false; $("#panel").hidden = true; $("#logout").hidden = true; return; }
  const ok = (u.emailVerified && (u.email || "").toLowerCase() === SITE.adminEmail) || (await getDoc(doc(db, "admins", u.uid))).exists();
  if (!ok) {   // on ne déconnecte plus : la session du vendeur (même navigateur) reste ouverte
    $("#login").hidden = false; $("#panel").hidden = true; $("#logout").hidden = false;
    say(`Tu es connecté avec ${u.email || "un autre compte"}, qui n'est pas administrateur. Ta session reste ouverte : touche « Déconnexion » seulement si tu veux changer de compte.`, "warn");
    return;
  }
  $("#login").hidden = true; $("#panel").hidden = false; $("#logout").hidden = false; say("");
  firstSubs = true; firstReqs = true;
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
    onSnapshot(doc(db, "config", "maintenance"), s => { maint = s.exists() ? s.data() : null; paintMaint(); }),
    onSnapshot(collection(db, "users"), s => { users = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(collection(db, "items"), orderBy("createdAt", "desc"), limit(200)), s => { items = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }),
    onSnapshot(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100)), s => { reports = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); })
  );
});

const until = u => u.activeUntil?.toMillis?.() ?? 0;
const dateFr = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const norm = t => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ini = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const av = n => `<span class="a-av" style="background:${tileColor(n)}">${esc(ini(n))}</span>`;
const left = u => until(u) - Date.now();
const fmtD = m => {
  const d = Math.floor(m / DAY), h = Math.floor(m % DAY / 36e5), mi = Math.floor(m % 36e5 / 6e4), s = Math.floor(m % 6e4 / 1e3);
  return d ? `${d} j ${h} h ${mi} min ${s} s` : h ? `${h} h ${mi} min ${s} s` : `${mi} min ${s} s`;
};
const userState = u => u.status === "blocked" ? "blocked" : left(u) <= 0 ? "expired" : u.plan === "pro" ? "pro" : "trial";
const when = x => x?.toMillis?.() ?? Date.now();
const empty = (ic, t) => `<div class="a-empty">${icon(ic)}<p>${esc(t)}</p></div>`;
const chips = { pending: "wait", users: "all", items: "all" };
let fxNext = true;

function chipsHTML(defs, cnt) {
  $("#aChips").innerHTML = defs.map(([k, l]) => `<button class="a-chip" data-c="${k}" aria-pressed="${chips[tab] === k}">${l}<em>${cnt[k] || 0}</em></button>`).join("");
}

function userCard(u) {
  const st = userState(u), ms = left(u), mine = items.filter(i => i.ownerId === u.id);
  const pill = { blocked: '<span class="pill bad">Bloquée</span>', expired: '<span class="pill bad">Expirée</span>', pro: '<span class="pill ok">Abonnée</span>', trial: '<span class="pill warn">Essai</span>' }[st];
  const pct = st === "blocked" || ms <= 0 ? 0 : Math.min(100, Math.round(ms / (30 * DAY) * 100));
  const meter = st === "blocked" ? "Compte suspendu" : ms <= 0 ? `Terminé le ${dateFr(until(u))}` : `${fmtD(ms)} restants, jusqu'au ${dateFr(until(u))}`;
  return `<article class="a-card" data-row data-uid="${esc(u.id)}">
    <div class="a-head">${av(u.shopName)}<div class="a-id"><b>${esc(u.shopName)}</b><small>${esc(prettyPhone(u.phone))} · ${esc(u.email)}</small></div>${pill}</div>
    <div class="a-meter ${st}"><div class="a-bar"><i style="width:${pct}%"></i></div><span${st === "trial" || st === "pro" ? ` data-until="${until(u)}"` : ""}>${esc(meter)}</span></div>
    <div class="a-stats"><span><b>${mine.filter(i => i.status !== "sold").length}</b> en ligne</span><span><b>${mine.filter(i => i.status === "sold").length}</b> vendus</span>${u.createdAt?.toMillis ? `<span>Inscrite ${esc(ago(u.createdAt.toMillis()))}</span>` : ""}</div>
    <div class="a-actions">
      <a class="btn small ghost" href="${esc(waLink(u.phone, "Bonjour " + u.shopName + ", ici SokoPlus."))}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn small" data-a="sub">Abonner</button>
      <button class="btn small ${u.status === "blocked" ? "ok" : "warn"}" data-a="block">${u.status === "blocked" ? "Débloquer" : "Bloquer"}</button>
    </div></article>`;
}
function usersView(q) {
  const cnt = { all: users.length, trial: 0, pro: 0, expired: 0, blocked: 0 };
  users.forEach(u => cnt[userState(u)]++);
  chipsHTML([["all", "Toutes"], ["trial", "Essai"], ["pro", "Abonnées"], ["expired", "Expirées"], ["blocked", "Bloquées"]], cnt);
  const list = users.filter(u => (chips.users === "all" || userState(u) === chips.users) && (!q || norm(`${u.shopName} ${u.phone} ${u.email}`).includes(q)))
    .sort((a, b) => until(a) - until(b));
  return list.map(userCard).join("") || empty("shop", "Aucune boutique ne correspond.");
}

/* Modification de boutique : on affiche l'ancien et le nouveau côte à côte, puis l'admin valide ou refuse */
function reqCard(r) {
  const u = users.find(x => x.id === r.id) || {};
  const chg = (label, now, next) => next ? `<div class="a-chg"><small>${label}</small><span>${esc(now || "—")}</span><i>devient</i><b>${esc(next)}</b></div>` : "";
  return `<article class="a-card a-sub" data-row data-rid="${esc(r.id)}">
    <div class="a-top"><b>Modification de la boutique ${esc(u.shopName || "")}</b></div>
    <div class="a-meta">${r.status === "rejected" ? '<span class="pill bad">Refusée</span>' : '<span class="pill warn">À valider</span>'} <span>${esc(u.email || "")}</span> · <span>${ago(when(r.createdAt))}</span></div>
    ${chg("Nom", u.shopName, r.shopName && r.shopName !== u.shopName ? r.shopName : "")}
    ${chg("Numéro", u.phone ? prettyPhone(u.phone) : "", r.phone && r.phone !== u.phone ? prettyPhone(r.phone) : "")}
    ${r.logo ? `<div class="a-chg"><small>Photo de profil</small>${u.logo ? `<img src="${esc(thumb(u.logo, 120))}" alt="">` : "<span>aucune</span>"}<i>devient</i><a href="${esc(r.logo)}" target="_blank" rel="noopener"><img src="${esc(thumb(r.logo, 160))}" alt=""></a></div>` : ""}
    ${r.status === "rejected" && r.reason ? `<p class="a-desc">Motif : ${esc(r.reason)}</p>` : ""}
    <div class="a-actions">${r.status === "pending" ? '<button class="btn ok" data-a="rok">Valider</button><button class="btn ghost" data-a="rno">Refuser</button>' : '<button class="btn small ghost" data-a="rdel">Supprimer</button>'}</div>
  </article>`;
}
async function applyProfile(r, u) {
  if (!u) throw { message: "Boutique introuvable." };
  const patch = {};
  if (r.shopName) patch.shopName = r.shopName;
  if (r.logo) patch.logo = r.logo;
  if (r.phone && r.phone !== u.phone) {   // l'index « numéro -> email » suit le nouveau numéro
    if ((await getDoc(doc(db, "phoneIndex", r.phone))).exists()) throw { message: "Ce numéro est déjà utilisé par une autre boutique." };
    await setDoc(doc(db, "phoneIndex", r.phone), { uid: u.id, email: u.email });
    if (u.phone) await deleteDoc(doc(db, "phoneIndex", u.phone)).catch(() => { });
    patch.phone = r.phone;
  }
  await updateDoc(doc(db, "users", u.id), patch);
  const mineSnap = await getDocs(query(collection(db, "items"), where("ownerId", "==", u.id)));   // les articles déjà en ligne suivent
  await Promise.all(mineSnap.docs.map(d => updateDoc(d.ref, {
    shopName: patch.shopName ?? d.data().shopName, phone: patch.phone ?? d.data().phone, shopLogo: patch.logo ?? d.data().shopLogo ?? ""
  })));
  await deleteDoc(doc(db, "profileRequests", r.id));
}

function subCard(s) {
  const imgs = (s.images || []).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(thumb(u, 360))}" alt="" loading="lazy"></a>`).join("");
  return `<article class="a-card a-sub" data-row data-sid="${esc(s.id)}">
    <div class="a-gal">${imgs}</div>
    <div class="a-top"><b>${esc(s.title)}</b><span class="a-price">${money(s.price, s.currency)}</span></div>
    <div class="a-meta">${s.status === "rejected" ? '<span class="pill bad">Refusé</span>' : '<span class="pill warn">À valider</span>'} <span>${esc(s.shopName)}</span> · <span>${esc(s.category)}</span> · <span>${esc(s.city ? s.city + ", " + s.address : s.address)}</span> · <span>${ago(when(s.createdAt))}</span></div>
    ${s.description ? `<p class="a-desc">${esc(s.description)}</p>` : ""}
    ${s.status === "rejected" && s.reason ? `<p class="a-desc">Motif : ${esc(s.reason)}</p>` : ""}
    <div class="a-actions">${s.status === "pending" ? '<button class="btn ok" data-a="ok">Valider et publier</button><button class="btn ghost" data-a="no">Refuser</button>' : '<button class="btn small ghost" data-a="delsub">Supprimer</button>'}</div>
  </article>`;
}
function pendingView(q) {
  const base = subs.filter(s => s.status !== "approved");
  chipsHTML([["wait", "En attente"], ["rej", "Refusés"]], { wait: base.filter(s => s.status === "pending").length + reqs.filter(r => r.status === "pending").length, rej: base.filter(s => s.status === "rejected").length + reqs.filter(r => r.status === "rejected").length });
  const list = base.filter(s => (chips.pending === "wait" ? s.status === "pending" : s.status === "rejected") && (!q || norm(`${s.title} ${s.shopName} ${s.category}`).includes(q)));
  const rl = reqs.filter(r => (chips.pending === "wait" ? r.status === "pending" : r.status === "rejected") && (!q || norm(`${users.find(x => x.id === r.id)?.shopName || ""} ${r.shopName || ""}`).includes(q)));
  return (rl.map(reqCard).join("") + list.map(subCard).join("")) || empty("clock", chips.pending === "wait" ? "Rien à valider pour le moment. Tout est à jour." : "Aucun article refusé.");
}

function itemCard(i) {
  const img = i.images?.[0] ? `<img src="${esc(thumb(i.images[0], 160))}" alt="" loading="lazy">` : `<span>${esc((i.title || "?")[0])}</span>`;
  return `<article class="a-card a-item" data-row data-iid="${esc(i.id)}">
    <div class="a-pic" style="background:${tileColor(i.shopName)}">${img}</div>
    <div class="a-info"><b>${esc(i.title)}</b><small>${esc(i.shopName)} · ${money(i.price, i.currency)} · ${ago(when(i.createdAt))}</small>
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

function render() {
  const now = Date.now(), waiting = subs.filter(s => s.status === "pending").length + reqs.filter(r => r.status === "pending").length;
  const live = items.filter(i => i.status !== "sold").length, pro = users.filter(u => userState(u) === "pro").length;
  $("#aWho").textContent = auth.currentUser?.email || "";
  $("#aDate").textContent = new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("#kPend").textContent = waiting; $("#kPendBox").classList.toggle("hot", waiting > 0);
  $("#kPendSub").textContent = waiting ? "à regarder maintenant" : "tout est à jour";
  $("#kShops").textContent = users.length; $("#kShopsSub").textContent = `${pro} abonnée${pro > 1 ? "s" : ""} · ${users.length - pro} autre${users.length - pro > 1 ? "s" : ""}`;
  $("#kItems").textContent = live; $("#kItemsSub").textContent = `${items.length - live} vendu${items.length - live > 1 ? "s" : ""}`;
  $("#kReports").textContent = reports.length;
  $("#pCount").textContent = waiting; $("#pCount").classList.toggle("hot", waiting > 0);
  $("#uCount").textContent = users.length; $("#iCount").textContent = items.length;
  $("#rCount").textContent = reports.length; $("#rCount").classList.toggle("hot", reports.length > 0);
  document.title = (waiting ? `(${waiting}) ` : "") + "Administration – SokoPlus";
  $$("[data-t]").forEach(b => b.setAttribute("aria-selected", b.dataset.t === tab));
  $("#aSearch").placeholder = { pending: "Chercher un article ou une boutique", users: "Chercher une boutique, un numéro, un e-mail", items: "Chercher un article", reports: "Chercher un signalement" }[tab];
  const list = $("#list");
  list.classList.toggle("a-in", fxNext); fxNext = false;
  list.innerHTML = { pending: pendingView, users: usersView, items: itemsView, reports: reportsView }[tab](norm($("#aSearch").value.trim()));
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
$$("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; fxNext = true; render(); });
$("#aSearch").addEventListener("input", () => render());
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
  } catch (err) { toast("Échec : " + (err.code || err.message)); }
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
    catch (err) { toast("Échec : " + (err.code || err.message)); }
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
  } catch (err) { resetGo(); toast("Échec : " + (err.code || err.message)); }
};
$("#mStop").onclick = async e => {
  try {
    await run(e.currentTarget, () => setDoc(doc(db, "config", "maintenance"), { on: false, until: Timestamp.fromMillis(Date.now()), message: maint?.message || "", startedAt: maint?.startedAt || serverTimestamp() }), { busy: "Réouverture…", done: "Site rouvert", hold: 700 });
    md.close(); toast("Le site est de nouveau ouvert à tout le monde.");
  } catch (err) { toast("Échec : " + (err.code || err.message)); }
};

$("#list").addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const row = b.closest("[data-row]"), a = b.dataset.a;
  try {
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
          await setDoc(doc(db, "items", s.id), {
            title: s.title, description: s.description, price: s.price, category: s.category, address: s.address, city: s.city || "", currency: s.currency || "USD", images: s.images,
            ownerId: s.ownerId, shopName: owner?.shopName || s.shopName, phone: owner?.phone || s.phone, shopLogo: owner?.logo || "", status: "available", featured: false, createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, "submissions", s.id), { status: "approved" });
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
    if (a === "feat") { const i = items.find(x => x.id === row.dataset.iid); await updateDoc(doc(db, "items", i.id), { featured: !i.featured }); }
    if (a === "del" || a === "delitem") {
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer ?"; return setTimeout(() => { delete b.dataset.sure; b.textContent = a === "del" ? "Supprimer" : "Supprimer l'article"; }, 3000); }
      await deleteDoc(doc(db, "items", row.dataset.iid));
      if (row.dataset.rid) await deleteDoc(doc(db, "reports", row.dataset.rid));
    }
    if (a === "dismiss") await deleteDoc(doc(db, "reports", row.dataset.rid));
  } catch (err) { toast("Échec : " + (err.code || err.message)); }
});
