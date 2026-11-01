/* Avis clients : étoiles et commentaire sur une boutique. Chaque avis est validé par SokoPlus avant d'être affiché. */
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit, serverTimestamp } from "./fb.js";
import { $, esc, ago, toast, thumb, tileColor, isNetErr, NET_MSG } from "./common.js";

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
export async function reviewsOf(itemId) {
  const s = await getDocs(query(collection(db, "reviews"), where("itemId", "==", itemId), where("status", "==", "approved"), limit(60)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b) - ms(a));
}

/* « Cet avis m'a été utile » : un vote par personne et par avis (identifiant = uid_avis). Une seule lecture pour toute la boutique. */
async function votesOf(shopId, uid) {
  const m = new Map();
  try {
    const s = await getDocs(query(collection(db, "reviewVotes"), where("shopId", "==", shopId), limit(500)));
    s.docs.forEach(d => { const v = d.data(), e = m.get(v.reviewId) || { n: 0, mine: false }; e.n++; if (uid && v.uid === uid) e.mine = true; m.set(v.reviewId, e); });
  } catch { /* votes indisponibles : les avis restent affichés */ }
  return m;
}
const THUMB = '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const helpTxt = n => n === 1 ? "1 personne a trouvé cet avis utile" : `${n} personnes ont trouvé cet avis utile`;
const avatar = r => { const lg = r.buyerLogo ? thumb(r.buyerLogo, 96) : ""; return `<span class="rv-av" style="background:${tileColor(r.buyerName || "Client")}">${esc((r.buyerName || "C")[0].toUpperCase())}${lg ? `<img src="${esc(lg)}" alt="" loading="lazy" draggable="false" onerror="this.remove()">` : ""}</span>`; };
const helpBtn = (r, v) => `<div class="rv-help"><button type="button" class="rv-up" data-help="${esc(r.id)}" aria-pressed="${!!v.mine}">${THUMB}<span>Utile${v.n ? ` (${v.n})` : ""}</span></button>${v.n ? `<small>${helpTxt(v.n)}</small>` : ""}</div>`;

/* Affiche la note moyenne, la répartition, les avis (avec photo et bouton « utile ») et le bouton « Donner mon avis » */
export async function renderReviews(box, itemId, shopId, shopName) {
  box.hidden = false;
  const T = '<h2 class="rv-t">Avis sur cet article</h2>';
  box.innerHTML = `${T}<p class="note">Chargement…</p>`;
  let list = [], votes = new Map(), me = null;
  try { [list, me] = await Promise.all([reviewsOf(itemId), who()]); votes = await votesOf(shopId, me?.uid); }
  catch (e) { box.innerHTML = `${T}<p class="note">${isNetErr(e) ? NET_MSG : "Les avis ne sont pas disponibles pour le moment."}</p>`; return; }
  const v = r => votes.get(r.id) || { n: 0, mine: false };
  list.sort((a, b) => v(b).n - v(a).n || ms(b) - ms(a));   // les plus utiles d'abord
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => [n, list.filter(r => Math.round(r.stars) === n).length]);
  box.innerHTML = `${T}
    ${list.length ? `<div class="rv-sum"><div class="rv-big"><b class="rv-avg">${fmt(avg)}</b><span class="rv-st" aria-label="${fmt(avg)} sur 5">${stars(avg)}</span><span class="note">${list.length} avis</span></div>
      <div class="rv-dist">${dist.map(([n, c]) => `<div><span>${n}★</span><i><b style="width:${Math.round(c / list.length * 100)}%"></b></i><em>${c}</em></div>`).join("")}</div></div>` : ""}
    <div class="rv-cta">${list.length ? "" : `<p class="rv-empty"><b>Aucun témoignage pour le moment.</b><br><small>Sois le premier à donner ton avis sur cet article.</small></p>`}
      <button class="btn small" type="button" id="rvGive">Donner mon avis</button></div>
    ${list.slice(0, 10).map(r => `<article class="rv" data-rid="${esc(r.id)}">${avatar(r)}<div class="rv-main"><div class="rv-h"><b>${esc(r.buyerName || "Client")}</b><span class="rv-st">${stars(r.stars)}</span><small>${esc(ago(ms(r) || Date.now()))}</small></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}${helpBtn(r, v(r))}</div></article>`).join("")}`;
  box.dispatchEvent(new CustomEvent("rvdone", { detail: { avg, n: list.length } }));
  $("#rvGive", box).onclick = () => openReview(itemId, shopId, shopName);
  box.onclick = async e => {
    const b = e.target.closest("[data-help]"); if (!b) return;
    const r = list.find(x => x.id === b.dataset.help); if (!r) return;
    const u = await who();
    if (!u) return toast("Connecte-toi (c'est gratuit) pour dire qu'un avis est utile.", { onClick: () => { location.href = "compte.html"; }, ms: 3500 });
    if (u.uid === r.buyerId) return toast("Tu ne peux pas voter pour ton propre avis.");
    const cur = v(r), on = !cur.mine, vid = `${u.uid}_${r.id}`;
    votes.set(r.id, { n: Math.max(0, cur.n + (on ? 1 : -1)), mine: on });   // affichage immédiat, annulé en cas d'erreur
    const art = b.closest(".rv-help"); art.outerHTML = helpBtn(r, votes.get(r.id));
    try {
      if (on) await setDoc(doc(db, "reviewVotes", vid), { reviewId: r.id, shopId, uid: u.uid, createdAt: serverTimestamp() });
      else await deleteDoc(doc(db, "reviewVotes", vid));
    } catch (err) {
      votes.set(r.id, cur); const el = box.querySelector(`[data-rid="${CSS.escape(r.id)}"] .rv-help`); if (el) el.outerHTML = helpBtn(r, cur);
      toast(isNetErr(err) ? NET_MSG : "Ton vote n'a pas pu être enregistré. Réessaie dans un instant.");
    }
  };
}

let dlg;
async function openReview(itemId, shopId, shopName) {
  if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "rvDlg"; document.body.append(dlg); dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); }); }
  const head = `<div class="dlg-head"><h2>Avis sur ${esc(shopName)}</h2><button class="x" data-close aria-label="Fermer">×</button></div>`;
  dlg.innerHTML = `<div class="dlg">${head}<p class="note">Un instant…</p></div>`; dlg.showModal();
  const u = await who();
  if (!u) { dlg.innerHTML = `<div class="dlg">${head}<p class="note">Connecte-toi avec ton compte gratuit pour donner ton avis.</p><a class="btn" href="compte.html">Me connecter ou créer un compte</a></div>`; return; }
  if (u.uid === shopId) { dlg.innerHTML = `<div class="dlg">${head}<p class="note">Tu ne peux pas noter ton propre article.</p></div>`; return; }
  let old = null;
  try { const s = await getDoc(doc(db, "reviews", `${u.uid}_${itemId}`)); if (s.exists()) old = s.data(); } catch { /* pas d'ancien avis lisible */ }
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
      let logo = "";   // photo de profil affichée avec l'avis (celle de sa boutique s'il en a une)
      try { const sh = await getDoc(doc(db, "users", u.uid)); const l = sh.exists() ? sh.data().logo : ""; if (typeof l === "string" && /^https:\/\//.test(l) && l.length <= 300) logo = l; } catch { /* sans photo */ }
      const data = { itemId, shopId, buyerId: u.uid, buyerName: b.data().name, ...(logo ? { buyerLogo: logo } : {}), stars: val, text: $("#rvText", dlg).value.trim().slice(0, 300), status: "pending", createdAt: old ? old.createdAt : serverTimestamp() };
      await setDoc(doc(db, "reviews", `${u.uid}_${itemId}`), data);
      dlg.close(); toast("Merci ! Ton avis sera visible après vérification.");
    } catch (err) { msg(isNetErr(err) ? NET_MSG : err.code === "permission-denied" ? "Ton avis n'a pas pu être envoyé. Recharge la page et réessaie." : (err.message || "Oups, réessaie dans un instant.")); btn.disabled = false; }
  };
}
