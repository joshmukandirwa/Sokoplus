/* Lien de partage d'un article : /p/ID  ->  /api/share?id=ID
   Renvoie une page avec les balises og: de l'article (photo, nom, prix + description),
   que WhatsApp, Facebook, Telegram... lisent. Les humains sont redirigés vers l'article. */

const PROJECT = "sokoplus-6b1a0";
const SITE = "https://sokoplus-rdc.vercel.app";
const DEFAULT_IMG = SITE + "/icons/og-image.png";
const DEFAULT_TITLE = "SokoPlus - Achetez et vendez partout en RDC";
const DEFAULT_DESC = "Le marché en ligne de la RDC : trouve des articles près de chez toi, contacte le vendeur sur WhatsApp et paie en Mobile Money. Vends gratuitement 30 jours.";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (price, cur) => {
  const n = Number(price) || 0;
  if (cur === "FC") return Math.round(n).toLocaleString("fr-FR") + " FC";
  return Number(n.toFixed(2)).toLocaleString("fr-FR") + " $";
};

/* Photo 1200x630 via Cloudinary (fond flou autour si la photo n'est pas au bon format) */
const ogImage = u => {
  if (typeof u !== "string" || !u.startsWith("https://res.cloudinary.com/") || !u.includes("/upload/")) return DEFAULT_IMG;
  return u.replace("/upload/", "/upload/w_1200,h_630,c_pad,b_blurred:400:15,q_auto,f_jpg/");
};

const val = f => f == null ? undefined : (f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue);

async function getItem(id) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/items/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const f = (await r.json()).fields || {};
  return {
    title: val(f.title), description: val(f.description), price: val(f.price), currency: val(f.currency),
    status: val(f.status), city: val(f.city), shopName: val(f.shopName),
    image: f.images?.arrayValue?.values?.[0]?.stringValue
  };
}

module.exports = async function handler(req, res) {
  const id = String(req.query.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  let it = null;
  try { if (id) it = await getItem(id); } catch { /* on retombe sur l'aperçu SokoPlus */ }

  const target = id ? `${SITE}/index.html?item=${encodeURIComponent(id)}` : SITE + "/";
  const pageUrl = id ? `${SITE}/p/${encodeURIComponent(id)}` : SITE + "/";

  let title = DEFAULT_TITLE, desc = DEFAULT_DESC, img = DEFAULT_IMG;
  if (it && it.title) {
    const price = money(it.price, it.currency) + (it.status === "sold" ? " (Vendu)" : "");
    title = `${it.title} - ${price}`;
    const where = [it.city, it.shopName].filter(Boolean).join(" · ");
    const text = String(it.description || "").replace(/\s+/g, " ").trim();
    desc = (text ? text.slice(0, 180) + (text.length > 180 ? "…" : "") : "Disponible sur SokoPlus") + (where ? ` | ${where}` : "");
    img = ogImage(it.image);
  }

  const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SokoPlus">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body>
<p>Ouverture de l'article… <a href="${esc(target)}">Cliquer ici si rien ne se passe</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(html);
}
