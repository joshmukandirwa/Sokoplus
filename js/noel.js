/* Ambiance fêtes : charge le style, change les logos et fait tomber de minuscules flocons ❄ */
const root = document.documentElement;
root.classList.add("noel");
if (!document.getElementById("noelCss")) {
  const l = document.createElement("link"); l.id = "noelCss"; l.rel = "stylesheet"; l.href = "css/noel.css"; document.head.append(l);
}

/* Logos de fête (l'icône de l'app installée, elle, ne change pas) */
const swap = () => {
  document.querySelectorAll('img[src$="icons/logo-full.png"]').forEach(i => { i.src = "icons/noel-logo.png"; });
  document.querySelectorAll('.instsheet-ic[src$="icons/logo-mark.png"]').forEach(i => { i.src = "icons/noel-mark.png"; });
};
swap(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true });

/* Neige en 3 plans (grands flocons flous devant, moyens, petits au fond) avec le vrai flocon : effet de profondeur au défilement,
   flocons qui se retournent en tombant, rafales de vent, et petites étincelles dorées quand on touche l'écran. */
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const cv = document.createElement("canvas"); cv.id = "noelSnow"; cv.setAttribute("aria-hidden", "true"); document.body.append(cv);
  const ctx = cv.getContext("2d"), img = new Image(), low = (navigator.hardwareConcurrency || 4) <= 4;
  let W = 0, H = 0, dpr = 1, flakes = [], sparks = [], sprites = [], raf = 0, last = 0, sy = scrollY, T = 0;
  const mk = (size, blur) => {
    const pad = 8, c = document.createElement("canvas"), x = c.getContext("2d");
    c.width = c.height = Math.ceil((size + pad * 2) * dpr); x.scale(dpr, dpr);
    if (blur) x.filter = `blur(${blur}px)`;
    x.shadowColor = "rgba(160,215,255,.95)"; x.shadowBlur = blur ? 10 : 6; x.drawImage(img, pad, pad, size, size);
    return { c, w: size + pad * 2 };
  };
  const build = () => { dpr = Math.min(devicePixelRatio || 1, 2); sprites = [mk(9, 0), mk(13, 0), mk(19, 0), mk(27, 0), mk(38, 0), mk(58, 3.2)]; };
  const spawn = (top) => {
    const r = Math.random(), layer = r < .12 ? 5 : r < .30 ? 4 : r < .55 ? 3 : r < .8 ? 2 : r < .93 ? 1 : 0, z = [.25, .35, .5, .7, .85, 1.1][layer];
    return { x: Math.random() * W, y: top ? -60 : Math.random() * H, layer, z, v: 16 + z * 46 + Math.random() * 14, sway: 6 + Math.random() * 18, ph: Math.random() * 6.28, flip: Math.random() * 6.28, fv: .6 + Math.random() * 1.6, rot: Math.random() * 6.28, rv: (Math.random() - .5) * .9, a: layer === 5 ? .55 : .55 + Math.random() * .4 };
  };
  const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const reset = () => { size(); const n = Math.round(Math.min(64, Math.max(28, W / 6.5)) * (low ? .65 : 1)); flakes = Array.from({ length: n }, () => spawn(false)); };
  const star = (x, y, r) => { ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
  const burst = (x, y) => {
    for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, v = 50 + Math.random() * 130; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1, r: 2 + Math.random() * 3.2, gold: Math.random() < .55 }); }
    for (let k = 0; k < 3; k++) { const f = spawn(false); f.x = x + (Math.random() - .5) * 40; f.y = y + (Math.random() - .5) * 20; f.layer = 3; f.z = .7; f.v = 30; f.a = .95; flakes.push(f); }
    if (flakes.length > 110) flakes.splice(0, flakes.length - 110);
  };
  const tick = t => {
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; T += dt;
    const dy = scrollY - sy; sy = scrollY;
    const wind = Math.sin(T / 5) * 16 + Math.sin(T / 1.7) * 7 + Math.max(-60, Math.min(60, dy * 1.4));
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.v * dt - dy * f.z * .55; f.ph += dt * .9; f.x += (Math.sin(f.ph) * f.sway + wind * f.z) * dt; f.rot += f.rv * dt; f.flip += f.fv * dt;
      if (f.y > H + 60) Object.assign(f, spawn(true)); else if (f.y < -80) f.y = H + 50;
      if (f.x < -60) f.x = W + 50; else if (f.x > W + 60) f.x = -50;
      const sp = sprites[f.layer]; if (!sp) continue;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(Math.max(.4, Math.abs(Math.cos(f.flip))), 1); ctx.globalAlpha = f.a * (.75 + .25 * Math.sin(f.ph * 2.3));
      ctx.drawImage(sp.c, -sp.w / 2, -sp.w / 2, sp.w, sp.w); ctx.restore();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const q = sparks[i]; q.life -= dt * 1.15; if (q.life <= 0) { sparks.splice(i, 1); continue; }
      q.vy += 90 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .985;
      ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.gold ? "#ffd86b" : "#fff"; ctx.shadowColor = q.gold ? "rgba(255,200,60,.9)" : "rgba(170,220,255,.9)"; ctx.shadowBlur = 8; star(q.x, q.y, q.r * (.6 + q.life * .6));
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && sprites.length) { last = performance.now(); sy = scrollY; raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  img.onload = () => { build(); reset(); start(); };
  img.src = "icons/noel-flake.png";
  addEventListener("resize", () => { if (sprites.length) reset(); });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  document.addEventListener("pointerdown", e => { if (sprites.length) burst(e.clientX, e.clientY); }, { passive: true });
}

/* Le Père Noël traverse l'écran 1,4 s après l'ouverture de l'accueil ; un toucher dessus fait jaillir des étincelles (comme ailleurs) */
(function sleigh() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.dataset.page !== "home") return;
  const w = document.createElement("div"); w.className = "noel-sleigh"; w.setAttribute("aria-hidden", "true");
  w.style.top = (14 + Math.random() * 12).toFixed(1) + "vh";
  w.innerHTML = '<img src="icons/noel-traineau.gif" alt="" draggable="false">';
  w.addEventListener("animationend", e => { if (e.animationName === "noelFly") w.remove(); });
  setTimeout(() => document.body.append(w), 1400);
})();

/* ---------- Bandeau de fêtes (accueil) : vœux + compte à rebours jusqu'à Noël, puis jusqu'au Nouvel An ---------- */
export function festiveMsg(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (m === 0 && d <= 10) return { title: `Bonne année ${y} !`, sub: "Que cette année apporte de belles ventes à tous." };
  if (m === 11 && d === 25) return { title: "Joyeux Noël !", sub: "Toute l'équipe SokoPlus vous souhaite de belles fêtes." };
  const noel = new Date(y, 11, 25), nouvelAn = new Date(y + 1, 0, 1);
  const target = now < noel ? noel : nouvelAn, label = now < noel ? "Noël" : "Nouvel An";
  const ms = target - now, dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
  return { title: "Joyeuses fêtes", label, parts: [[dd, "j"], [String(hh).padStart(2, "0"), "h"], [String(mm).padStart(2, "0"), "min"]] };
}
(function strip() {
  if (document.body.dataset.page !== "home") return;
  const host = document.querySelector(".hero"); if (!host) return;
  const box = document.createElement("div"); box.className = "noel-strip"; box.setAttribute("role", "status");
  const paint = () => {
    const f = festiveMsg();
    box.innerHTML = `<span class="ns-ic" aria-hidden="true"><img src="icons/noel-flake.png" alt=""></span>
      <div class="ns-tx"><b>${f.title}</b>${f.parts ? `<small>${f.label} dans</small>` : `<small>${f.sub}</small>`}</div>
      ${f.parts ? `<div class="ns-cd">${f.parts.map(([v, u]) => `<span><b>${v}</b><i>${u}</i></span>`).join("")}</div>` : ""}`;
  };
  paint(); host.after(box); setInterval(paint, 30000);
})();
