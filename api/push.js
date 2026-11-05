/* Notifications push gratuites (sans Cloud Functions) : POST /api/push
   - { type: "user", notifId }  : un message de SokoPlus vient d'être écrit à un vendeur -> notification sur ses appareils (admin seulement)
   - { type: "item", itemId }   : un article vient d'être mis en ligne -> notification aux abonnés (propriétaire ou admin)
   Chaque demande doit porter le jeton de connexion Firebase (Authorization: Bearer ...). Variable Vercel requise : FIREBASE_SERVICE_ACCOUNT. */
const admin = require("firebase-admin");

const SITE = (process.env.SITE_URL || "https://sokoplus-rdc.vercel.app").replace(/\/$/, "");
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
        if (!cats.length || cats.includes(item.category)) tokens.push(d.id);
      });
      const price = Number(item.price) || 0, cur = item.currency === "FC" ? " FC" : " $", link = `${SITE}/?item=${ref.id}`;
      let sent = 0;
      if (folTokens.length) sent += await send(db, folTokens, wrap(`${item.shopName || "Une boutique"} a publié`, `${String(item.title || "article")} · ${price.toLocaleString("fr-FR")}${cur}`, link));
      if (tokens.length) sent += await send(db, tokens, wrap(`Nouveau : ${String(item.title || "article")}`, `${item.shopName || "SokoPlus"} · ${price.toLocaleString("fr-FR")}${cur}`, link));
      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ ok: false, error: "Type inconnu" });
  } catch (e) {
    console.error("push", e);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
};
