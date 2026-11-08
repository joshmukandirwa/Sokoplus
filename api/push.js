/* Notifications push gratuites (sans Cloud Functions) : POST /api/push
   - { type: "user", notifId }  : un message de SokoPlus vient d'être écrit à un vendeur -> notification sur ses appareils (admin seulement)
   - { type: "item", itemId }   : un article vient d'être mis en ligne -> notification aux abonnés (propriétaire ou admin)
   - { type: "want", wantId }   : une demande « Je cherche… » vient d'être publiée -> notification aux vendeurs qui ont déjà des articles dans cette catégorie (demandeur ou admin)
   - { type: "group", itemId }   : quelqu'un vient de rejoindre un achat groupé -> message et notification au vendeur (participant)
   Chaque demande doit porter le jeton de connexion Firebase (Authorization: Bearer ...). Variable Vercel requise : FIREBASE_SERVICE_ACCOUNT. */
const admin = require("firebase-admin");

const SITE = (process.env.SITE_URL || "https://sokoplus-africa.vercel.app").replace(/\/$/, "");
const ADMIN_EMAIL = "joshmukandirwa@gmail.com";
const FRESH_MS = 15 * 60 * 1000; // on ne notifie que du contenu créé il y a moins de 15 minutes

function init() {
  if (admin.apps.length) return;
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT manquante");
  if (!raw.trim().startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const isDeadToken = r => !r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test((r.error && r.error.code) || "");

async function send(db, tokens, message) {
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({ ...message, tokens: chunk });
    sent += res.successCount;
    const dead = [];
    res.responses.forEach((r, j) => { if (isDeadToken(r)) dead.push(chunk[j]); });
    await Promise.all(dead.map(t => db.collection("pushTokens").doc(t).delete().catch(() => { })));
  }
  return sent;
}

const wrap = (title, body, link) => ({
  notification: { title: String(title).slice(0, 80), body: String(body).slice(0, 160) },
  webpush: { fcmOptions: { link }, notification: { icon: SITE + "/icons/icon-any-192.png" } }
});

const fresh = ts => { const t = ts && ts.toMillis ? ts.toMillis() : 0; return t && Date.now() - t < FRESH_MS; };

// Anciens noms de catégories (articles publiés avant la nouvelle liste) → nouveau nom
const LEGACY = { "Alimentation": "Alimentation & Boissons", "Mode": "Mode & Habillement", "Électronique": "Téléphones & Accessoires", "Maison": "Maison & Décoration", "Beauté": "Beauté & Soins personnels", "Artisanat": "Cadeaux & Artisanat", "Immobilier": "Bâtiment & Construction" };
const canon = c => LEGACY[c] || c;
const namesOf = c => [c, ...Object.keys(LEGACY).filter(k => LEGACY[k] === c)];

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "POST seulement" }); }
  try {
    init();
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ ok: false, error: "Connexion requise" });
    let caller;
    try { caller = await admin.auth().verifyIdToken(m[1]); } catch { return res.status(401).json({ ok: false, error: "Jeton invalide" }); }

    const db = admin.firestore();
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const isAdmin = (caller.email === ADMIN_EMAIL && caller.email_verified === true) || (await db.collection("admins").doc(caller.uid).get()).exists;

    if (body.type === "user") {
      if (!isAdmin) return res.status(403).json({ ok: false, error: "Réservé à l'administrateur" });
      const ref = db.collection("userNotifs").doc(String(body.notifId || "x"));
      const claimed = await db.runTransaction(async t => {
        const s = await t.get(ref); const d = s.exists && s.data();
        if (!d || d.pushedAt || !fresh(d.createdAt)) return null;
        t.update(ref, { pushedAt: admin.firestore.FieldValue.serverTimestamp() });
        return d;
      });
      if (!claimed) return res.status(200).json({ ok: true, sent: 0 });
      const snap = await db.collection("pushTokens").where("uid", "==", claimed.uid).get();
      const sent = await send(db, snap.docs.map(d => d.id), wrap(claimed.title || "Message de SokoPlus", claimed.text || "", SITE + "/vendeur.html"));
      return res.status(200).json({ ok: true, sent });
    }

    if (body.type === "item") {
      const ref = db.collection("items").doc(String(body.itemId || "x"));
      const first = await ref.get();
      if (!first.exists) return res.status(404).json({ ok: false, error: "Article introuvable" });
      if (!isAdmin && first.data().ownerId !== caller.uid) return res.status(403).json({ ok: false, error: "Ce n'est pas ton article" });
      const item = await db.runTransaction(async t => {
        const s = await t.get(ref); const d = s.exists && s.data();
        if (!d || d.pushedAt || d.status !== "available" || !fresh(d.createdAt)) return null;
        t.update(ref, { pushedAt: admin.firestore.FieldValue.serverTimestamp() });
        return d;
      });
      if (!item) return res.status(200).json({ ok: true, sent: 0 });
      const fol = new Set((await db.collection("follows").where("shopId", "==", item.ownerId).get()).docs.map(d => d.data().uid));
      const snap = await db.collection("pushTokens").get();
      const tokens = [], folTokens = [];
      snap.forEach(d => {
        const x = d.data(), cats = x.cats || [];
        if (x.uid && x.uid === item.ownerId) return;                    // le vendeur ne reçoit pas sa propre annonce
        if (x.uid && fol.has(x.uid)) { folTokens.push(d.id); return; }  // abonnés : message personnel, pas de doublon avec l'alerte générale
        if (!cats.length || cats.includes(canon(item.category))) tokens.push(d.id);
      });
      const price = Number(item.price) || 0, cur = item.currency === "FC" ? " FC" : " $", link = `${SITE}/?item=${ref.id}`;
      let sent = 0;
      if (folTokens.length) sent += await send(db, folTokens, wrap(`${item.shopName || "Une boutique"} a publié`, `${String(item.title || "article")} · ${price.toLocaleString("fr-FR")}${cur}`, link));
      if (tokens.length) sent += await send(db, tokens, wrap(`Nouveau : ${String(item.title || "article")}`, `${item.shopName || "SokoPlus"} · ${price.toLocaleString("fr-FR")}${cur}`, link));
      return res.status(200).json({ ok: true, sent });
    }

    if (body.type === "want") {
      const ref = db.collection("wants").doc(String(body.wantId || "x"));
      const first = await ref.get();
      if (!first.exists) return res.status(404).json({ ok: false, error: "Demande introuvable" });
      if (!isAdmin && first.data().ownerId !== caller.uid) return res.status(403).json({ ok: false, error: "Ce n'est pas ta demande" });
      const want = await db.runTransaction(async t => {
        const s = await t.get(ref); const d = s.exists && s.data();
        if (!d || d.pushedAt || d.status !== "open" || !fresh(d.createdAt)) return null;
        t.update(ref, { pushedAt: admin.firestore.FieldValue.serverTimestamp() });
        return d;
      });
      if (!want) return res.status(200).json({ ok: true, sent: 0 });
      // 1) les gens de sa ville (ou de son pays si leur ville n'est pas connue), 2) les vendeurs qui ont déjà publié dans cette catégorie, dans le même pays
      const its = await db.collection("items").where("category", "in", namesOf(want.category)).limit(500).get();
      const vendors = new Set();
      its.forEach(d => { const x = d.data(); if ((x.country || "CD") === (want.country || "CD") && x.ownerId && x.ownerId !== want.ownerId) vendors.add(x.ownerId); });
      const snap = await db.collection("pushTokens").get();
      const near = new Set(), tokens = [];
      snap.forEach(d => {
        const x = d.data(); if (x.uid && x.uid === want.ownerId) return;
        const sameCity = want.city && x.city === want.city, sameCountry = (x.country || "CD") === (want.country || "CD") && !x.city;
        if (sameCity || (want.city && sameCountry) || (!want.city && x.country === want.country)) near.add(d.id);
        if (x.uid && vendors.has(x.uid)) near.add(d.id);
      });
      near.forEach(t => tokens.push(t));
      if (!tokens.length) return res.status(200).json({ ok: true, sent: 0 });
      const where = [want.city, want.budget ? `Budget ${Number(want.budget).toLocaleString("fr-FR")}${want.currency === "FC" ? " FC" : " $"}` : ""].filter(Boolean).join(" · ");
      const sent = await send(db, tokens, wrap(`Quelqu'un cherche : ${String(want.title).slice(0, 60)}`, where || "Ouvre la demande et réponds sur WhatsApp si tu l'as.", SITE + "/cherche.html"));
      return res.status(200).json({ ok: true, sent });
    }

    if (body.type === "group") {
      const gref = db.collection("groups").doc(String(body.itemId || "x")), mref = gref.collection("members").doc(caller.uid);
      const [g0, m0] = await Promise.all([gref.get(), mref.get()]);
      if (!g0.exists || !m0.exists) return res.status(404).json({ ok: false, error: "Groupe introuvable" });
      const out = await db.runTransaction(async t => {
        const [gs, ms] = await Promise.all([t.get(gref), t.get(mref)]);
        if (!gs.exists || !ms.exists || ms.data().notified || !fresh(ms.data().createdAt)) return null;
        const g = gs.data(), reached = g.count >= g.min && !g.reached;
        t.update(mref, { notified: true });
        if (reached) t.update(gref, { reached: true });
        return { g, name: ms.data().name, reached };
      });
      if (!out) return res.status(200).json({ ok: true, sent: 0 });
      const it = await db.collection("items").doc(gref.id).get(), title = it.exists ? String(it.data().title || "ton article") : "ton article";
      const title1 = out.reached ? "Objectif atteint : achat groupé" : "Nouveau participant à ton achat groupé";
      const text = out.reached ? `${out.g.count} personnes ont rejoint « ${title} ». Contacte-les sur WhatsApp depuis Ma boutique.` : `${out.name} a rejoint « ${title} » (${out.g.count}/${out.g.min}).`;
      await db.collection("userNotifs").add({ uid: out.g.ownerId, kind: "group", title: title1, text, read: false, pushedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });
      const snap = await db.collection("pushTokens").where("uid", "==", out.g.ownerId).get();
      const sent = await send(db, snap.docs.map(d => d.id), wrap(title1, text, SITE + "/vendeur.html"));
      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ ok: false, error: "Type inconnu" });
  } catch (e) {
    console.error("push", e);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
};
