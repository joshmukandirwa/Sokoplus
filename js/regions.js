/* Sélecteur de région : bouton + fenêtre avec recherche, villes groupées par province. */
export const OTHER = "Autre ville";   // valeur enregistrée (compatible avec les anciens articles), affichée « Autres »
export const REGIONS = [
  ["Kinshasa", ["Kinshasa"]],
  ["Kongo-Central", ["Matadi"]],
  ["Nord-Kivu", ["Goma", "Butembo", "Beni"]],
  ["Sud-Kivu", ["Bukavu", "Uvira"]],
  ["Haut-Katanga", ["Lubumbashi", "Likasi"]],
  ["Lualaba", ["Kolwezi"]],
  ["Tanganyika", ["Kalemie"]],
  ["Kasaï-Oriental", ["Mbuji-Mayi"]],
  ["Kasaï-Central", ["Kananga"]],
  ["Kasaï", ["Tshikapa"]],
  ["Tshopo", ["Kisangani"]],
  ["Ituri", ["Bunia"]],
  ["Équateur", ["Mbandaka"]]
];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const e = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const cityLabel = c => !c ? "Toute la RDC" : c === OTHER ? "Autres" : c;
const PIN = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const CARET = '<svg class="ic caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
export const regionBtnHTML = (c, id, extra = "") => `<button type="button" class="regbtn ${extra}" id="${id}" aria-haspopup="dialog">${PIN}<span>${e(cityLabel(c))}</span>${CARET}</button>`;
export const setRegionBtn = (btn, c) => { btn.querySelector("span").textContent = cityLabel(c); };

/* opts: { current, all: true pour proposer « Toute la RDC », onPick(city) } */
export function openRegionPicker({ current = "", all = true, onPick }) {
  const prev = document.activeElement;
  const ov = document.createElement("div");
  ov.className = "regov";
  ov.innerHTML = `<div class="regsheet" role="dialog" aria-modal="true" aria-label="Choisis ta région">
    <div class="reghead"><h2>Choisis ta région</h2><button type="button" class="x" aria-label="Fermer">✕</button></div>
    <label class="regsearch">${'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}<input type="search" placeholder="Cherche une ville…" autocomplete="off" aria-label="Chercher une ville"></label>
    <div class="reglist"></div></div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add("noscroll");
  const list = ov.querySelector(".reglist"), input = ov.querySelector("input");
  const chip = (val, label) => `<button type="button" class="regchip${val === current ? " on" : ""}" data-v="${e(val)}">${val === current ? "✓ " : ""}${e(label)}</button>`;
  const draw = () => {
    const q = norm(input.value.trim());
    let h = "";
    if (all && (!q || norm("Toute la RDC").includes(q))) h += `<div class="regall">${chip("", "🌍 Toute la RDC")}</div>`;
    let n = 0;
    for (const [prov, cities] of REGIONS) {
      const provHit = q && norm(prov).includes(q);
      const hits = cities.filter(c => !q || provHit || norm(c).includes(q));
      if (!hits.length) continue;
      n += hits.length;
      h += `<div class="regprov"><h3>${e(prov)}</h3><div class="regchips">${hits.map(c => chip(c, c)).join("")}</div></div>`;
    }
    if (!q || norm("Autres").includes(q) || !n) h += `<div class="regprov"><h3>Ailleurs</h3><div class="regchips">${chip(OTHER, "Autres")}</div></div>`;
    list.innerHTML = h;
  };
  const close = () => { ov.remove(); document.documentElement.classList.remove("noscroll"); document.removeEventListener("keydown", key); prev && prev.focus && prev.focus(); };
  const key = ev => { if (ev.key === "Escape") close(); };
  document.addEventListener("keydown", key);
  ov.addEventListener("click", ev => {
    if (ev.target === ov || ev.target.closest(".x")) return close();
    const b = ev.target.closest(".regchip"); if (!b) return;
    onPick(b.dataset.v); close();
  });
  input.addEventListener("input", draw);
  draw();
  if (matchMedia("(hover:hover)").matches) input.focus();
}
