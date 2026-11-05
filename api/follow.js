/* Abonnement à une boutique : POST /api/follow  { shopId, on: true|false }
   Le serveur est le seul à écrire dans « follows » et « shopStats » : personne ne peut gonfler ses abonnés, et la liste de qui suit qui reste privée.
   Variable Vercel requise : FIREBASE_SERVICE_ACCOUNT (la même que pour api/push.js). */
const admin = require("firebase-admin");

const SITE = (process.env.SITE_URL || "https://sokoplus-rdc.vercel.app").replace(/\/$/, "");
const MAX_FOLLOWS = 300;
const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];

function init() {
  if (admin.apps.length) return;
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT manquante");
  if (!raw.trim().startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const nice = n => n >= 1000 ? (Math.floor(n / 100) / 10).toString().replace(".", ",") + " k" : String(n);

async function congratulate(db, shopId, n) {
  const title = `${nice(n)} abonnés !`, text = `Bravo : ta boutique vient d'atteindre ${nice(n)} abonnés sur SokoPlus.`;
  await db.collection("userNotifs").add({ uid: shopId, kind: "followers", title, text, read: false, pushedAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });
  const snap = await db.collection("pushTokens").where("uid", "==", shopId).get();
  const tokens = snap.docs.map(d => d.id);
  if (!tokens.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens, notification: { title, body: text },
    webpush: { fcmOptions: { link: SITE + "/vendeur.html" }, notification: { icon: SITE + "/icons/icon-any-192.png" } }
  });
  const dead = [];
  res.responses.forEach((r, j) => { if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test((r.error && r.error.code) || "")) dead.push(tokens[j]); });
  await Promise.all(dead.map(t => db.collection("pushTokens").doc(t).delete().catch(() => { })));
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "POST seulement" }); }
  try {
    init();
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ ok: false, error: "Connexion requise" });
    let caller;
    try { caller = await admin.auth().verifyIdToken(m[1]); } catch { return res.status(401).json({ ok: false, error: "Jeton invalide" }); }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const shopId = String(body.shopId || ""), on = body.on !== false;
    if (!shopId || shopId.length > 128 || shopId.includes("/")) return res.status(400).json({ ok: false, error: "Boutique invalide" });
    if (shopId === caller.uid) return res.status(400).json({ ok: false, error: "Tu ne peux pas suivre ta propre boutique" });

    const db = admin.firestore();
    const shop = await db.collection("users").doc(shopId).get();
    if (!shop.exists || (shop.data().shopName || "") === "") return res.status(404).json({ ok: false, error: "Boutique introuvable" });

    const fRef = db.collection("follows").doc(`${caller.uid}_${shopId}`), sRef = db.collection("shopStats").doc(shopId);
    if (on) {
      const c = await db.collection("follows").where("uid", "==", caller.uid).count().get();
      if (c.data().count >= MAX_FOLLOWS) return res.status(429).json({ ok: false, error: `Tu peux suivre ${MAX_FOLLOWS} boutiques au maximum.` });
    }
    const r = await db.runTransaction(async t => {
      const [f, s] = await Promise.all([t.get(fRef), t.get(sRef)]);
      const cur = s.exists ? Math.max(0, Number(s.data().followers) || 0) : 0;
      if (on && !f.exists) {
        t.set(fRef, { uid: caller.uid, shopId, shopName: String(shop.data().shopName).slice(0, 60), logo: String(shop.data().logo || "").slice(0, 300), createdAt: admin.firestore.FieldValue.serverTimestamp() });
        t.set(sRef, { followers: cur + 1 }, { merge: true });
        return { following: true, followers: cur + 1, added: true };
      }
      if (!on && f.exists) {
        t.delete(fRef);
        t.set(sRef, { followers: Math.max(0, cur - 1) }, { merge: true });
        return { following: false, followers: Math.max(0, cur - 1) };
      }
      return { following: f.exists, followers: cur };
    });
    if (r.added && MILESTONES.includes(r.followers)) congratulate(db, shopId, r.followers).catch(e => console.error("palier", e));
    return res.status(200).json({ ok: true, following: r.following, followers: r.followers });
  } catch (e) {
    console.error("follow", e);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
};
