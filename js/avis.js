/* Avis clients : étoiles et commentaire sur une boutique. Chaque avis est validé par SokoPlus avant d'être affiché. */
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, collection, query, where, getDocs, limit, serverTimestamp } from "./fb.js";
import { $, esc, ago, toast, isNetErr, NET_MSG } from "./common.js";

const ms = r => r.createdAt?.toMillis?.() ?? 0;
const stars = n => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
const fmt = n => n.toFixed(1).replace(".", ",");

function who() {
  return new Promise(res => {
    if (!auth) return res(null);
    const to = setTimeout(() => res(null), 4000);
    const off = onAuthStateChanged(auth, u => { clearTimeout(to); off && off(); res(u); });
  });
}
export async function reviewsOf(shopId) {
  const s = await getDocs(query(collection(db, "reviews"), where("shopId", "==", shopId), where("status", "==", "approved"), limit(60)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b) - ms(a));
}

/* Affiche la note moyenne, les avis et le bouton « Donner mon avis » */
export async function renderReviews(box, shopId, shopName) {
  box.hidden = false;
  box.innerHTML = '<h2 class="rv-t">Avis des clients</h2><p class="note">Chargement…</p>';
  let list = [];
  try { list = await reviewsOf(shopId); }
  catch (e) { box.innerHTML = `<h2 class="rv-t">Avis des clients</h2><p class="note">${isNetErr(e) ? NET_MSG : "Les avis ne sont pas disponibles pour le moment."}</p>`; return; }
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0;
  box.innerHTML = `<h2 class="rv-t">Avis des clients</h2>
    <div class="rv-sum">${list.length ? `<b class="rv-avg">${fmt(avg)}</b><span class="rv-st" aria-label="${fmt(avg)} sur 5">${stars(avg)}</span><span class="note">${list.length} avis</span>` : '<span class="note">Aucun avis pour l\'instant. Sois le premier.</span>'}
      <button class="btn small" type="button" id="rvGive">Donner mon avis</button></div>
    ${list.slice(0, 10).map(r => `<article class="rv"><div class="rv-h"><b>${esc(r.buyerName || "Client")}</b><span class="rv-st">${stars(r.stars)}</span><small>${esc(ago(ms(r) || Date.now()))}</small></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}</article>`).join("")}`;
  $("#rvGive", box).onclick = () => openReview(shopId, shopName);
}

let dlg;
async function openReview(shopId, shopName) {
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "rvDlg"; document.body.append(dlg); dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); }); }
  const head = `<div class="dlg-head"><h2>Avis sur ${esc(shopName)}</h2><button class="x" data-close aria-label="Fermer">×</button></div>`;
  dlg.innerHTML = `<div class="dlg">${head}<p class="note">Un instant…</p></div>`; dlg.showModal();
  const u = await who();
  if (!u) { dlg.innerHTML = `<div class="dlg">${head}<p class="note">Connecte-toi avec ton compte gratuit pour donner ton avis.</p><a class="btn" href="compte.html">Me connecter ou créer un compte</a></div>`; return; }
  if (u.uid === shopId) { dlg.innerHTML = `<div class="dlg">${head}<p class="note">Tu ne peux pas noter ta propre boutique.</p></div>`; return; }
  let old = null;
  try { const s = await getDoc(doc(db, "reviews", `${u.uid}_${shopId}`)); if (s.exists()) old = s.data(); } catch { /* pas d'ancien avis lisible */ }
  let val = old?.stars || 0;
  dlg.innerHTML = `<div class="dlg">${head}
    <p class="note">${old ? "Tu as déjà donné un avis. Si tu le modifies, SokoPlus le vérifiera de nouveau." : "Ton avis sera visible après vérification par SokoPlus."}</p>
    <div class="rv-pick" role="radiogroup" aria-label="Note">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" data-s="${n}" aria-checked="false" aria-label="${n} sur 5">★</button>`).join("")}</div>
    <label class="field">Ton commentaire (facultatif)<textarea id="rvText" maxlength="300" placeholder="Qualité, accueil, rapidité…">${esc(old?.text || "")}</textarea></label>
    <p class="msg" id="rvMsg" hidden></p>
    <button class="btn" type="button" id="rvSend">Envoyer mon avis</button></div>`;
  const paint = () => dlg.querySelectorAll("[data-s]").forEach(b => { const on = Number(b.dataset.s) <= val; b.classList.toggle("on", on); b.setAttribute("aria-checked", Number(b.dataset.s) === val); });
  paint();
  dlg.querySelector(".rv-pick").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { val = Number(b.dataset.s); paint(); } };
  const msg = (t, k = "err") => { const m = $("#rvMsg", dlg); m.hidden = !t; m.className = "msg " + k; m.textContent = t || ""; };
  $("#rvSend", dlg).onclick = async () => {
    if (!val) return msg("Choisis une note de 1 à 5 étoiles.", "warn");
    const btn = $("#rvSend", dlg); btn.disabled = true; msg("");
    try {
      let b = await getDoc(doc(db, "buyers", u.uid));
      if (!b.exists()) {   // un vendeur sans fiche acheteur : on la crée avec le nom de sa boutique
        const shop = await getDoc(doc(db, "users", u.uid));
        const name = String(shop.exists() ? shop.data().shopName : u.displayName || (u.email || "").split("@")[0] || "Client").trim().slice(0, 40);
        await setDoc(doc(db, "buyers", u.uid), { name: name.length < 2 ? "Client" : name, createdAt: serverTimestamp() });
        b = await getDoc(doc(db, "buyers", u.uid));
      }
      const data = { shopId, buyerId: u.uid, buyerName: b.data().name, stars: val, text: $("#rvText", dlg).value.trim().slice(0, 300), status: "pending", createdAt: old ? old.createdAt : serverTimestamp() };
      await setDoc(doc(db, "reviews", `${u.uid}_${shopId}`), data);
      dlg.close(); toast("Merci ! Ton avis sera visible après vérification.");
    } catch (err) { msg(isNetErr(err) ? NET_MSG : err.code === "permission-denied" ? "Ton avis n'a pas pu être envoyé. Recharge la page et réessaie." : (err.message || "Oups, réessaie dans un instant.")); btn.disabled = false; }
  };
}
