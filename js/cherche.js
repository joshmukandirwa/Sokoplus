import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp } from "./fb.js";
import { SITE, canonCat, $, $$, esc, toast, ago, money, waLink, normPhone, tileColor, thumb, store } from "./common.js";
import { pingPush } from "./pushapi.js";
import { COUNTRIES, DEFAULT_COUNTRY, citiesOf, currenciesOf } from "./pays.js";

const DAYS = 30, MAX_DAY = 3, ADMIN_MAIL = "joshmukandirwa@gmail.com";
let wants = [], user = null, isAdmin = false, cat = "", q = "", myAvatar = "";
const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ms = w => w.createdAt?.toMillis?.() ?? Date.now();
const dayKey = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");   // jour en RDC (UTC+2)
const who = () => new Promise(res => { if (!auth) return res(null); const off = onAuthStateChanged(auth, u => { off(); res(u); }); });

/* ---------- liste ---------- */
const rank = w => { const c = store.get("city", ""), k = store.get("country", ""); return c && w.city === c ? 0 : k && (w.country || DEFAULT_COUNTRY) === k ? 1 : 2; };
function visible() {
  const old = Date.now() - DAYS * 864e5;
  return wants.filter(w => w.status !== "deleted" && (w.status === "open" || w.ownerId === user?.uid) && ms(w) > old && (!cat || canonCat(w.category) === cat)
    && (!q || norm(`${w.title} ${w.details || ""} ${w.city || ""} ${w.category}`).includes(norm(q))))
    .sort((a, b) => rank(a) - rank(b) || ms(b) - ms(a));   // d'abord ma ville, puis mon pays, puis le reste
}
function card(w) {
  const mine = user && w.ownerId === user.uid, found = w.status === "found";
  const msg = `Bonjour ${w.name}, j'ai vu ta demande « ${w.title} » sur SokoPlus. J'ai ce qu'il te faut. Je t'envoie des photos et le prix ?`;
  const place = [w.city, w.country && w.country !== DEFAULT_COUNTRY ? (COUNTRIES.find(c => c[0] === w.country)?.[1] || "") : ""].filter(Boolean).join(", ");
  return `<article class="wn-card${found ? " done" : ""}" data-id="${esc(w.id)}">
    <div class="wn-av" style="background:${tileColor(w.name)}">${(w.avatar || (mine && myAvatar)) ? `<img src="${esc(thumb(w.avatar || myAvatar, 96))}" alt="" draggable="false">` : esc((w.name || "?")[0].toUpperCase())}</div>
    <div class="wn-body">
      <div class="wn-top"><b>${esc(w.name)}</b><small>${esc(ago(ms(w)))}${place ? " · " + esc(place) : ""}</small></div>
      <h3>${esc(w.title)}</h3>
      ${w.details ? `<p>${esc(w.details)}</p>` : ""}
      <div class="wn-tags">${rank(w) === 0 ? '<span class="near">Près de toi</span>' : ""}<span>${esc(canonCat(w.category))}</span>${w.budget ? `<span class="bud">Budget : ${esc(money(w.budget, w.currency))}</span>` : ""}${found ? '<span class="ok">Trouvé</span>' : ""}</div>
      <div class="wn-acts">
        ${found ? (mine ? '<button class="btn small" data-react type="button">Réactiver ma demande</button>' : "") : mine ? '<button class="btn small" data-found type="button">Je l\'ai trouvé</button>' : `<a class="btn small wn-wa" target="_blank" rel="noopener" href="${esc(waLink(w.phone, msg))}">J'ai ça, je lui écris</a>`}
        ${mine ? '<button class="btn small ghost" data-mydel type="button">Supprimer</button>' : ""}
        ${isAdmin && !mine ? '<button class="btn small ghost" data-del type="button">Supprimer</button>' : ""}
      </div></div></article>`;
}
function render() {
  $("#wnChips").innerHTML = ["", ...SITE.categories].map(c => `<button type="button" data-c="${esc(c)}" aria-pressed="${c === cat}">${c ? esc(c) : "Toutes"}</button>`).join("");
  const l = visible();
  $("#wnList").innerHTML = l.map(card).join("");
  $("#wnEmpty").hidden = !!l.length;
  window.SOKO?.reveal?.();
}
if (db) onSnapshot(query(collection(db, "wants"), orderBy("createdAt", "desc"), limit(120)), s => { wants = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { $("#wnList").innerHTML = '<p class="note">Impossible de charger les demandes. Vérifie ta connexion et recharge la page.</p>'; });
else render();
who().then(async u => {
  user = u;
  if (u) { try { const sh = await getDoc(doc(db, "users", u.uid)); myAvatar = (sh.exists() && sh.data().logo) || u.photoURL || ""; } catch { myAvatar = u.photoURL || ""; } }
  if (u) { try { isAdmin = (await getDoc(doc(db, "admins", u.uid))).exists() || (u.email === ADMIN_MAIL && u.emailVerified); } catch { /* pas admin */ } }
  render();
});
$("#wnChips").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; cat = b.dataset.c; render(); });
$("#wnQ").addEventListener("input", e => { q = e.target.value.trim(); $("#wnX").hidden = !e.target.value; render(); });
$("#wnX").addEventListener("click", () => { const i = $("#wnQ"); i.value = ""; q = ""; $("#wnX").hidden = true; render(); i.focus(); });
$("#wnList").addEventListener("click", async e => {
  const c = e.target.closest("[data-id]"); if (!c) return;
  const w = wants.find(x => x.id === c.dataset.id); if (!w) return;
  try {
    if (e.target.closest("[data-react]")) { await updateDoc(doc(db, "wants", w.id), { status: "open" }); toast("Ta demande est de nouveau visible par tout le monde."); }
    if (e.target.closest("[data-found]")) { await updateDoc(doc(db, "wants", w.id), { status: "found" }); toast("Super, ta demande est fermée. Bonne affaire !"); }
    if (e.target.closest("[data-mydel]")) {
      if (!window.confirm("Supprimer cette demande définitivement ? Elle disparaît pour tout le monde et tu ne pourras plus la réactiver.")) return;
      await updateDoc(doc(db, "wants", w.id), { status: "deleted" }); toast("Ta demande est supprimée.");
    }
    if (e.target.closest("[data-del]")) {
      const why = (window.prompt(`Motif de suppression (obligatoire, ${w.name} le verra) :`, "") || "").trim().slice(0, 200);
      if (why.length < 3) return toast("Le motif est obligatoire.");
      await addDoc(collection(db, "userNotifs"), { uid: w.ownerId, kind: "item_removed", title: "Ta demande a été retirée", text: `SokoPlus a retiré ta demande « ${w.title} ». Motif : ${why}.`, read: false, createdAt: serverTimestamp() });
      await deleteDoc(doc(db, "wants", w.id)); toast("Demande supprimée. Le motif est envoyé.");
    }
  } catch { toast("Action impossible pour le moment. Réessaie dans un instant."); }
});

/* ---------- publier ma demande ---------- */
let dlg;
$("#wnNew").addEventListener("click", async () => {
  const u = user || await who(); user = u;
  if (!u) return toast("Connecte-toi (c'est gratuit) pour publier ta demande.", { onClick: () => { location.href = "compte.html"; }, ms: 3500 });
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "wnDlg"; document.body.append(dlg); dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); }); }
  let name = "", phone = "";
  try {
    const b = await getDoc(doc(db, "buyers", u.uid)), sh = await getDoc(doc(db, "users", u.uid));
    name = b.exists() ? b.data().name : sh.exists() ? sh.data().shopName : u.displayName || "";
    phone = sh.exists() ? sh.data().phone || "" : "";
    if (!myAvatar) myAvatar = (sh.exists() && sh.data().logo) || u.photoURL || "";
  } catch { /* champs vides */ }
  const country = DEFAULT_COUNTRY;
  dlg.innerHTML = `<div class="dlg"><div class="dlg-head"><h2>Je cherche…</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <form id="wnForm" class="wn-form" novalidate>
      <label class="field">Qu'est-ce que tu cherches ?<input id="wT" maxlength="80" placeholder="Ex : iPhone 11 en bon état" required></label>
      <label class="field">Détails (facultatif)<textarea id="wD" maxlength="300" rows="3" placeholder="Couleur, taille, état, quantité…"></textarea></label>
      <div class="cols"><label class="field">Catégorie<select id="wC">${SITE.categories.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
      <label class="field">Pays<select id="wCo">${COUNTRIES.map(c => `<option value="${c[0]}"${c[0] === country ? " selected" : ""}>${esc(c[1])}</option>`).join("")}</select></label></div>
      <div class="cols"><label class="field">Ville<select id="wV"></select></label>
      <label class="field">Budget max (facultatif)<input id="wB" type="number" inputmode="decimal" min="0" step="any" placeholder="Ex : 200"></label></div>
      <label class="field">Monnaie du budget<select id="wM"></select></label>
      <label class="field">Ton prénom<input id="wN" maxlength="40" value="${esc(name)}" required></label>
      <label class="field">Ton numéro WhatsApp<input id="wP" type="tel" inputmode="tel" value="${esc(phone)}" placeholder="0993 582 704 ou +250 788 357 924" required></label>
      <p class="note">Les vendeurs te répondent sur ce numéro. Il est visible par ceux qui ouvrent ta demande. Maximum ${MAX_DAY} demandes par jour.</p>
      <p class="msg" id="wMsg" hidden></p>
      <button class="btn" type="submit">Publier ma demande</button></form></div>`;
  const fill = c => {
    $("#wV", dlg).innerHTML = '<option value="">Choisis ta ville</option>' + citiesOf(c).map(x => `<option>${esc(x)}</option>`).join("");
    $("#wM", dlg).innerHTML = currenciesOf(c).map(x => `<option>${esc(x)}</option>`).join("");
  };
  fill(country); $("#wCo", dlg).addEventListener("change", e => fill(e.target.value));
  const say = t => { const m = $("#wMsg", dlg); m.hidden = !t; m.className = "msg err"; m.textContent = t || ""; };
  $("#wnForm", dlg).addEventListener("submit", async e => {
    e.preventDefault(); say("");
    const title = $("#wT", dlg).value.trim(), nm = $("#wN", dlg).value.trim(), ph = normPhone($("#wP", dlg).value), budget = Number($("#wB", dlg).value);
    if (title.length < 2) return say("Écris ce que tu cherches (2 lettres au minimum).");
    if (nm.length < 2) return say("Écris ton prénom.");
    if (!ph) return say("Ce numéro WhatsApp n'a pas l'air valide. Exemple : 0993 582 704 (RDC) ou +250 788 357 924 (autre pays, avec +).");
    const btn = e.submitter || $("button[type=submit]", dlg); btn.disabled = true;
    try {
      let slot = null;
      for (let n = 1; n <= MAX_DAY && !slot; n++) { const id = `${u.uid}_${dayKey()}_${n}`; if (!(await getDoc(doc(db, "wants", id))).exists()) slot = id; }
      if (!slot) { say(`Tu as déjà publié tes ${MAX_DAY} demandes d'aujourd'hui. Reviens demain.`); btn.disabled = false; return; }
      const data = { title, category: $("#wC", dlg).value, country: $("#wCo", dlg).value, name: nm, phone: ph, ownerId: u.uid, status: "open", createdAt: serverTimestamp() };
      const det = $("#wD", dlg).value.trim(), city = $("#wV", dlg).value;
      if (det) data.details = det; if (city) data.city = city;
      if (/^https:\/\//.test(myAvatar) && myAvatar.length <= 400) data.avatar = myAvatar;
      if (budget > 0) { data.budget = budget; data.currency = $("#wM", dlg).value; }
      await setDoc(doc(db, "wants", slot), data);
      pingPush({ type: "want", wantId: slot });   // prévient les vendeurs de cette catégorie
      dlg.close(); toast("Ta demande est publiée. Les vendeurs vont te répondre sur WhatsApp.");
    } catch { say("La demande n'a pas pu être publiée. Vérifie ta connexion et réessaie."); btn.disabled = false; }
  });
  dlg.showModal();
});
