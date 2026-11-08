/* Achats groupés : plusieurs acheteurs se regroupent pour obtenir le prix de groupe du vendeur. */
import { auth, db, onAuthStateChanged, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, writeBatch, increment, serverTimestamp, Timestamp } from "./fb.js";
import { esc, money, toast, waLink, normPhone } from "./common.js";
import { pingPush } from "./pushapi.js";

const who = () => new Promise(res => { if (!auth) return res(null); const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
const left = ms => {
  if (ms <= 0) return "terminé";
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};
const endMs = g => g.endsAt?.toMillis?.() ?? 0;

/* ---------- côté acheteur : encart sur la page article ---------- */
export async function paintGroup(d, it) {
  const box = d.querySelector("#grpBox"); if (!box) return;
  box.innerHTML = '<p class="note">Chargement de l\'achat groupé…</p>';
  let g = null, mine = false, u = null;
  try {
    u = await who();
    const gs = await getDoc(doc(db, "groups", it.id)); g = gs.exists() ? gs.data() : null;
    if (g && u) mine = (await getDoc(doc(db, "groups", it.id, "members", u.uid))).exists();
  } catch { box.innerHTML = ""; return; }
  if (!d.contains(box)) return;
  const min = it.groupMin, count = g ? g.count : 0, ended = g && endMs(g) <= Date.now(), reached = count >= min;
  const cut = Math.round((1 - it.groupPrice / it.price) * 100), pct = Math.min(100, Math.round(count / min * 100));
  const owner = u && u.uid === it.ownerId;
  let state;
  if (!g) state = `Personne n'a encore rejoint. Sois le premier : le groupe dure ${it.groupDays} jours.`;
  else if (ended && reached) state = "Objectif atteint. Le vendeur contacte les participants.";
  else if (ended) state = "Ce groupe s'est terminé sans atteindre l'objectif. Le vendeur peut en relancer un autre.";
  else if (reached) state = `Objectif atteint ! Il reste ${left(endMs(g) - Date.now())} pour rejoindre au prix de groupe.`;
  else state = `Il reste ${left(endMs(g) - Date.now())}. Encore ${min - count} personne${min - count > 1 ? "s" : ""} pour débloquer le prix.`;
  let act = "";
  if (owner) act = '<p class="note">C\'est ton article : gère le groupe dans Ma boutique.</p>';
  else if (mine) act = ended ? '<p class="note ok">Tu fais partie de ce groupe.</p>' : '<p class="note ok">Tu as rejoint ce groupe. Le vendeur te contactera sur WhatsApp.</p><button type="button" class="btn small ghost" data-gleave>Quitter le groupe</button>';
  else if (!g || !ended) act = '<button type="button" class="btn" data-gjoin>Je rejoins l\'achat groupé</button>';
  box.innerHTML = `<h4>Achat groupé : ${esc(money(it.groupPrice, it.currency))} <s>${esc(money(it.price, it.currency))}</s> <em>-${cut} %</em></h4>
    <p class="gtxt">Quand ${min} personnes rejoignent, le vendeur vous vend l'article au prix de groupe.</p>
    <div class="gbar" role="progressbar" aria-valuemin="0" aria-valuemax="${min}" aria-valuenow="${Math.min(count, min)}"><i style="width:${pct}%"></i></div>
    <p class="gcount"><b>${count} / ${min}</b> personnes</p><p class="gtxt">${esc(state)}</p>${act}<div class="gform" hidden></div>`;
  box.querySelector("[data-gjoin]")?.addEventListener("click", async () => {
    const u2 = u || await who();
    if (!u2) return toast("Connecte-toi (c'est gratuit) pour rejoindre le groupe.", { onClick: () => { location.href = "compte.html"; }, ms: 3500 });
    let name = "", phone = "";
    try {
      const b = await getDoc(doc(db, "buyers", u2.uid)), sh = await getDoc(doc(db, "users", u2.uid));
      name = b.exists() ? b.data().name : sh.exists() ? sh.data().shopName : u2.displayName || "";
      phone = sh.exists() ? sh.data().phone || "" : "";
    } catch { /* champs vides */ }
    const f = box.querySelector(".gform"); f.hidden = false;
    f.innerHTML = `<label class="field">Ton prénom<input id="gN" maxlength="40" value="${esc(name)}"></label>
      <label class="field">Ton numéro WhatsApp<input id="gP" type="tel" inputmode="tel" value="${esc(phone)}" placeholder="0993 582 704 ou +250 788 357 924"></label>
      <p class="note">Seul le vendeur voit ton numéro, pour t'appeler quand le groupe est complet. Tu peux quitter le groupe quand tu veux.</p>
      <p class="msg err" hidden></p><button type="button" class="btn" data-gok>Confirmer</button>`;
    box.querySelector("[data-gjoin]").hidden = true;
    f.querySelector("[data-gok]").addEventListener("click", async ev => {
      const err = f.querySelector(".msg"), nm = f.querySelector("#gN").value.trim(), ph = normPhone(f.querySelector("#gP").value);
      err.hidden = true;
      if (nm.length < 2) { err.textContent = "Écris ton prénom."; err.hidden = false; return; }
      if (!ph) { err.textContent = "Ce numéro WhatsApp n'a pas l'air valide. Exemple : 0993 582 704 (RDC) ou +250 788 357 924."; err.hidden = false; return; }
      ev.target.disabled = true;
      try {
        const gref = doc(db, "groups", it.id), bt = writeBatch(db);
        bt.set(doc(db, "groups", it.id, "members", u2.uid), { uid: u2.uid, name: nm, phone: ph, ownerId: it.ownerId, createdAt: serverTimestamp() });
        if (!g) bt.set(gref, { itemId: it.id, ownerId: it.ownerId, count: 1, min, startedAt: serverTimestamp(), endsAt: Timestamp.fromMillis(Date.now() + it.groupDays * 864e5) });
        else bt.update(gref, { count: increment(1) });
        await bt.commit();
        pingPush({ type: "group", itemId: it.id });
        toast("Tu as rejoint le groupe. Le vendeur te contactera.");
        paintGroup(d, it);
      } catch { err.textContent = "Impossible de rejoindre le groupe (le groupe est peut-être terminé). Recharge la page et réessaie."; err.hidden = false; ev.target.disabled = false; }
    });
  });
  box.querySelector("[data-gleave]")?.addEventListener("click", async ev => {
    ev.target.disabled = true;
    try {
      const bt = writeBatch(db);
      bt.delete(doc(db, "groups", it.id, "members", u.uid));
      bt.update(doc(db, "groups", it.id), { count: increment(-1) });
      await bt.commit(); toast("Tu as quitté le groupe."); paintGroup(d, it);
    } catch { toast("Impossible de quitter le groupe pour le moment."); ev.target.disabled = false; }
  });
}

/* ---------- côté vendeur : gérer le groupe d'un article ---------- */
export async function openSellerGroup(it) {
  let dlg = document.getElementById("grpDlg");
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "grpDlg"; document.body.append(dlg); dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); }); }
  dlg.innerHTML = '<div class="dlg"><p class="note">Chargement…</p></div>'; if (!dlg.open) dlg.showModal();
  let g = null, members = [];
  try {
    const gs = await getDoc(doc(db, "groups", it.id)); g = gs.exists() ? gs.data() : null;
    if (g) members = (await getDocs(query(collection(db, "groups", it.id, "members"), where("ownerId", "==", auth.currentUser.uid)))).docs.map(x => x.data()).sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  } catch { dlg.innerHTML = '<div class="dlg"><div class="dlg-head"><h2>Achat groupé</h2><button class="x" data-close aria-label="Fermer">×</button></div><p class="note">Impossible de charger le groupe. Vérifie ta connexion.</p></div>'; return; }
  const min = it.groupMin, ended = g && endMs(g) <= Date.now(), reached = g && g.count >= min;
  const status = !g ? "Aucun participant pour l'instant." : ended ? (reached ? "Terminé : objectif atteint." : "Terminé : objectif non atteint.") : reached ? `Objectif atteint ! Il reste ${left(endMs(g) - Date.now())}.` : `En cours : il reste ${left(endMs(g) - Date.now())}.`;
  dlg.innerHTML = `<div class="dlg"><div class="dlg-head"><h2>Achat groupé</h2><button class="x" data-close aria-label="Fermer">×</button></div>
    <p><b>${esc(it.title)}</b><br>${esc(money(it.groupPrice, it.currency))} au lieu de ${esc(money(it.price, it.currency))} · minimum ${min} personnes · ${it.groupDays} jours</p>
    <p class="gcount"><b>${g ? g.count : 0} / ${min}</b> personnes · ${esc(status)}</p>
    <div class="gmembers">${members.map(m => `<div class="gm"><span><b>${esc(m.name)}</b><small>${esc(m.phone)}</small></span><a class="btn small wn-wa" target="_blank" rel="noopener" href="${esc(waLink(m.phone, `Bonjour ${m.name}, c'est ${it.shopName || "le vendeur"} sur SokoPlus. L'achat groupé de « ${it.title} » ${reached ? "est complet" : "avance bien"} : le prix de groupe est de ${money(it.groupPrice, it.currency)}. On s'organise pour la remise ?`))}">WhatsApp</a></div>`).join("") || '<p class="note">Les participants apparaîtront ici avec leur numéro WhatsApp.</p>'}</div>
    ${g ? '<button type="button" class="btn ghost" data-restart>Relancer un nouveau groupe</button><p class="note">Relancer efface les participants actuels et repart de zéro. Fais-le quand tu as fini avec ce groupe.</p>' : ""}</div>`;
  dlg.querySelector("[data-restart]")?.addEventListener("click", async ev => {
    if (!ev.target.dataset.sure) { ev.target.dataset.sure = "1"; ev.target.textContent = "Confirmer : effacer le groupe ?"; return; }
    ev.target.disabled = true;
    try {
      for (const m of members) await deleteDoc(doc(db, "groups", it.id, "members", m.uid));
      await deleteDoc(doc(db, "groups", it.id)); toast("Nouveau groupe prêt."); openSellerGroup(it);
    } catch { toast("Impossible de relancer pour le moment."); ev.target.disabled = false; }
  });
}
