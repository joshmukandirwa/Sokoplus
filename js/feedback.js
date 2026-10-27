// Retours visuels sur les boutons : chargement (rond qui tourne), réussite (coche verte) ou erreur (secousse rouge).
const wait = ms => new Promise(r => setTimeout(r, ms));
export const btnOf = e => e.submitter || e.target.querySelector('button[type="submit"]');

export async function run(btn, task, { busy = "", done = "", hold = 1000 } = {}) {
  if (!btn || btn.dataset.fx) return task();
  const plain = !btn.children.length, label = btn.textContent, wasDisabled = btn.disabled;
  btn.dataset.fx = "1"; btn.disabled = true; btn.classList.add("is-busy");
  if (plain && busy) btn.textContent = busy;
  const reset = () => {
    btn.classList.remove("is-busy", "is-done", "is-fail"); btn.disabled = wasDisabled; delete btn.dataset.fx;
    if (plain) btn.textContent = label;
  };
  let out;
  try { if (navigator.onLine === false) throw Object.assign(new Error("Pas de connexion internet. Vérifie ton réseau puis réessaie."), { code: "auth/network-request-failed" }); out = await task(); }
  catch (err) {
    btn.classList.replace("is-busy", "is-fail"); if (plain) btn.textContent = label;
    setTimeout(reset, 600);
    throw err;
  }
  btn.classList.replace("is-busy", "is-done"); if (plain && done) btn.textContent = done;
  await wait(hold); reset();
  return out;
}
