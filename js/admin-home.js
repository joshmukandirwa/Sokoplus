/* Tableau de bord de l'admin : chiffres, demandes de certification, activité, courbe, boutiques récentes. Tout vient des vraies données. */
import { esc, ago, thumb, tileColor } from "./common.js";
import { icon } from "./icons.js";

const DAY = 864e5;
const ts = x => x?.toMillis?.() ?? 0;
const day0 = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const plural = (n, s, p = s + "s") => `${n} ${n > 1 ? p : s}`;

function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`; }
  return d;
}
/* nombre de créations par jour sur les n derniers jours */
function daily(list, n) {
  const today = day0(Date.now()), out = Array(n).fill(0);
  list.forEach(x => { const t = ts(x.createdAt); if (!t) return; const i = n - 1 - Math.floor((today - day0(t)) / DAY); if (i >= 0 && i < n) out[i]++; });
  return out;
}
function spark(v, color, id) {
  const w = 140, h = 44, m = Math.max(1, ...v), pts = v.map((y, i) => [i * (w / (v.length - 1)), h - 5 - (y / m) * (h - 14)]), d = smooth(pts);
  return `<svg class="ad-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w},${h} L0,${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const kpi = (cls, ic, label, val, delta, sp) => `<div class="ad-kpi ${cls}"><div class="ad-kh"><span class="ad-kic">${icon(ic)}</span><span>${label}</span></div><div class="ad-kv"><b>${val}</b><em>${delta}</em></div>${sp}</div>`;

/* ---------- courbe ---------- */
let last = null;
function chart(range, items, users) {
  const step = range === 90 ? 3 : 1, n = range / step, today = day0(Date.now()), t0 = today - (range - 1) * DAY;
  const rows = [...Array(n)].map((_, i) => ({ t: t0 + i * step * DAY, a: 0, b: 0 }));
  const put = (arr, k) => arr.forEach(x => { const t = ts(x.createdAt); if (t < t0 || t >= today + DAY) return; rows[Math.min(n - 1, Math.floor((t - t0) / (step * DAY)))][k]++; });
  put(items, "a"); put(users, "b");
  const W = 520, H = 240, L = 30, R = 10, T = 12, B = 30, pw = W - L - R, ph = H - T - B;
  const peak = Math.max(4, ...rows.map(r => Math.max(r.a, r.b))), max = Math.ceil(peak / 4) * 4;
  const X = i => L + i * pw / (n - 1), Y = v => T + ph - v / max * ph;
  const line = k => smooth(rows.map((r, i) => [X(i), Y(r[k])]));
  const grid = [0, 1, 2, 3, 4].map(g => `<line x1="${L}" x2="${W - R}" y1="${Y(max / 4 * g)}" y2="${Y(max / 4 * g)}" class="ad-grid"/><text x="${L - 6}" y="${Y(max / 4 * g) + 4}" text-anchor="end">${max / 4 * g}</text>`).join("");
  const every = n <= 7 ? 1 : n <= 15 ? 3 : 6;
  const lab = rows.map((r, i) => i % every ? "" : `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${n <= 7 ? new Date(r.t).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "") : new Date(r.t).toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" })}</text>`).join("");
  last = { rows, step, W, L, R, n };
  return `<div class="ad-chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Articles publiés et boutiques inscrites"><defs><linearGradient id="adA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1470ff" stop-opacity=".28"/><stop offset="1" stop-color="#1470ff" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${line("a")} L${X(n - 1)},${Y(0)} L${X(0)},${Y(0)} Z" fill="url(#adA)"/><path d="${line("a")}" class="ad-l1"/><path d="${line("b")}" class="ad-l2"/>
    <g class="ad-hov" hidden><line y1="${T}" y2="${T + ph}"/><circle r="5" class="h1"/><circle r="5" class="h2"/></g>${lab}</svg><div class="ad-tip" hidden></div></div>
    <div class="ad-legend"><span><i class="l1"></i>Articles publiés</span><span><i class="l2"></i>Boutiques inscrites</span></div>`;
}
/* info-bulle : appelée par admin.js quand le doigt ou la souris bouge sur la courbe */
export function chartTip(e) {
  const box = e.target.closest("[data-chart]"); if (!box || !last) return;
  const svg = box.querySelector("svg"), r = svg.getBoundingClientRect(), { rows, W, L, R, n, step } = last;
  const px = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / (n - 1)))));
  const row = rows[i], X = L + i * (W - L - R) / (n - 1), tip = box.querySelector(".ad-tip"), g = box.querySelector(".ad-hov");
  const max = Math.max(4, ...rows.map(q => Math.max(q.a, q.b))), top = Math.ceil(max / 4) * 4, ph = 240 - 12 - 30, Y = v => 12 + ph - v / top * ph;
  g.hidden = false; g.querySelector("line").setAttribute("x1", X); g.querySelector("line").setAttribute("x2", X);
  g.querySelector(".h1").setAttribute("cx", X); g.querySelector(".h1").setAttribute("cy", Y(row.a)); g.querySelector(".h2").setAttribute("cx", X); g.querySelector(".h2").setAttribute("cy", Y(row.b));
  const d = new Date(row.t), end = new Date(row.t + (step - 1) * DAY), f = x => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  tip.hidden = false; tip.style.left = `${Math.min(86, Math.max(14, X / W * 100))}%`;
  tip.innerHTML = `<b>${step > 1 ? `${f(d)} – ${f(end)}` : f(d)}</b><span>${plural(row.a, "article")}</span><span>${plural(row.b, "boutique")}</span>`;
}

/* ---------- page ---------- */
export function homeHTML(c) {
  const { users, items, subs, creqs, reports, revs, buyers, range, av, state, waiting } = c;
  const live = items.filter(i => i.status !== "sold"), activeShops = users.filter(u => ["trial", "pro"].includes(state(u)));
  const wk = list => daily(list, 7).reduce((a, b) => a + b, 0);
  const dl = list => { const k = wk(list); return k ? `+${k} cette semaine` : "stable"; };
  const kpis = `<div class="ad-kpis">
    ${kpi("k1", "shop", "Boutiques actives", activeShops.length, dl(users), spark(daily(users, 7), "#1470ff", "sp1"))}
    ${kpi("k2", "box", "Articles en ligne", live.length, dl(items), spark(daily(items, 7), "#13a04a", "sp2"))}
    ${kpi("k3", "users", "Acheteurs inscrits", buyers.length, dl(buyers), spark(daily(buyers, 7), "#7a4dd8", "sp3"))}
    ${kpi("k4", "clock", "À valider", waiting, waiting ? "à regarder maintenant" : "tout est à jour", spark(daily([...subs, ...creqs, ...revs], 7), "#f0650a", "sp4"))}
  </div>`;

  const pend = creqs.filter(r => r.status === "pending").sort((a, b) => ts(a.createdAt) - ts(b.createdAt)).slice(0, 4);
  const rows = pend.map(r => { const u = users.find(x => x.id === r.id) || {}; return `<div class="ad-tr" data-row data-cid="${esc(r.id)}">
      <div class="ad-shop">${av(u.shopName || "?", u.logo)}<b>${esc(u.shopName || "Boutique")}</b></div>
      <span class="ad-pill wait">En attente</span><time>${ts(r.createdAt) ? new Date(ts(r.createdAt)).toLocaleDateString("fr-FR") : ""}</time>
      <div class="ad-act"><button class="ad-ok" data-a="cok" aria-label="Approuver">${icon("check")}</button><button class="ad-no" data-a="cno" aria-label="Refuser">${icon("close")}</button></div></div>`; }).join("");
  const certCard = `<section class="ad-card"><header><h2><span class="ad-hic blue">${icon("shield")}</span>Demandes de certification${pend.length ? `<em class="ad-bd">${creqs.filter(r => r.status === "pending").length}</em>` : ""}</h2><button class="ad-more" data-go="pending">Voir tout${icon("arrow")}</button></header>
    ${rows ? `<div class="ad-table"><div class="ad-th"><span>Boutique</span><span>Statut</span><span>Date</span><span>Actions</span></div>${rows}</div>` : `<p class="ad-none">Aucune demande en attente. Tout est à jour.</p>`}</section>`;

  const ev = [];
  users.forEach(u => ev.push({ t: ts(u.createdAt), ic: "shop", cl: "blue", h: "Une nouvelle boutique a été inscrite", s: u.shopName }));
  creqs.filter(r => r.status === "pending").forEach(r => ev.push({ t: ts(r.createdAt), ic: "shield", cl: "orange", h: "Une demande de certification reçue", s: users.find(x => x.id === r.id)?.shopName }));
  subs.filter(s => s.status === "pending").forEach(s => ev.push({ t: ts(s.createdAt), ic: "clock", cl: "orange", h: s.replaces ? "Une modification d'article à valider" : "Un article attend sa validation", s: `${s.title} · ${s.shopName}` }));
  items.forEach(i => ev.push({ t: ts(i.createdAt), ic: "box", cl: "green", h: "Un nouveau produit publié", s: i.shopName }));
  reports.forEach(r => ev.push({ t: ts(r.createdAt), ic: "bell", cl: "red", h: "Un signalement reçu", s: r.reason }));
  revs.filter(r => r.status === "pending").forEach(r => ev.push({ t: ts(r.createdAt), ic: "chat", cl: "purple", h: "Un avis à valider", s: users.find(x => x.id === r.shopId)?.shopName }));
  const act = ev.filter(e => e.t).sort((a, b) => b.t - a.t).slice(0, 5).map(e => `<li><span class="ad-hic ${e.cl}">${icon(e.ic)}</span><div><b>${esc(e.h)}</b><small>${esc(ago(e.t))}${e.s ? " · " + esc(e.s) : ""}</small></div></li>`).join("");
  const actCard = `<section class="ad-card"><header><h2><span class="ad-hic blue">${icon("bolt")}</span>Activité récente</h2></header>${act ? `<ul class="ad-act-list">${act}</ul>` : `<p class="ad-none">Rien de nouveau pour le moment.</p>`}</section>`;

  const statCard = `<section class="ad-card"><header><h2><span class="ad-hic blue">${icon("chart")}</span>Statistiques</h2>
    <div class="ad-seg" role="group" aria-label="Période">${[7, 30, 90].map(r => `<button type="button" data-r="${r}" aria-pressed="${r === range}">${r} j</button>`).join("")}</div></header>${chart(range, items, users)}</section>`;

  const recent = [...users].sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 4).map(u => {
    const st = state(u), city = items.find(i => i.ownerId === u.id)?.city || "";
    const pill = { blocked: ["bad", "Bloquée"], expired: ["bad", "Expirée"], pro: ["ok", "Abonnée"], trial: ["ok", "Active"] }[st];
    return `<li><div class="ad-shop">${av(u.shopName || "?", u.logo)}<div><b>${esc(u.shopName)}${u.certified ? `<img class="cert-ic" src="icons/certifie.png" width="15" height="15" alt="Certifiée" draggable="false">` : ""}</b><small>${esc(city ? city + " · " : "")}${esc(ago(ts(u.createdAt) || Date.now()))}</small></div></div><span class="ad-pill ${pill[0]}">${pill[1]}</span></li>`;
  }).join("");
  const shopCard = `<section class="ad-card"><header><h2><span class="ad-hic blue">${icon("shop")}</span>Boutiques récentes</h2><button class="ad-more" data-go="users">Voir tout${icon("arrow")}</button></header>${recent ? `<ul class="ad-shops">${recent}</ul>` : `<p class="ad-none">Aucune boutique pour le moment.</p>`}</section>`;

  return `${kpis}<div class="ad-grid2">${certCard}${actCard}</div><div class="ad-grid2">${statCard}${shopCard}</div>`;
}
