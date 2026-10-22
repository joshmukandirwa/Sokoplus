// Envoie une notification push à tous les appareils inscrits à chaque nouvel article.
// Option B du README : demande le forfait Firebase "Blaze" (carte bancaire, usage gratuit à ton niveau).
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notifyNewItem = onDocumentCreated(
  { document: "items/{id}", region: process.env.FN_REGION || "europe-west1" },
  async event => {
    const item = event.data && event.data.data();
    if (!item) return;

    const db = admin.firestore();
    const snap = await db.collection("pushTokens").get();
    const tokens = [];
    snap.forEach(d => {
      const cats = d.data().cats || [];
      if (!cats.length || cats.includes(item.category)) tokens.push(d.id);
    });
    if (!tokens.length) return;

    const base = (process.env.SITE_URL || "").replace(/\/$/, "");
    const message = {
      notification: {
        title: `Nouveau à Goma : ${String(item.title).slice(0, 60)}`,
        body: `${item.shopName} · ${Number(item.price).toLocaleString("fr-FR")} $`
      },
      webpush: { fcmOptions: { link: `${base}/?item=${event.params.id}` } }
    };

    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await admin.messaging().sendEachForMulticast({ ...message, tokens: chunk });
      const dead = [];
      res.responses.forEach((r, j) => {
        const code = (r.error && r.error.code) || "";
        if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) dead.push(chunk[j]);
      });
      await Promise.all(dead.map(t => db.collection("pushTokens").doc(t).delete()));
    }
  }
);
