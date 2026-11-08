/* Note vocale du vendeur : enregistre (45 s max) dans la page « Publier un article ». */
const MAX = 45;
export const voiceSupported = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export function initVoice(root) {
  let blob = null, existing = "", exSec = 0, secs = 0, rec = null, stream = null, timer = null, t0 = 0, preview = "";
  const $ = s => root.querySelector(s);
  const btn = $("#vRec"), del = $("#vDel"), play = $("#vPlay"), time = $("#vTime"), msg = $("#vMsg");
  if (!voiceSupported()) { root.hidden = true; return { blob: () => null, existing: () => "", seconds: () => 0, setExisting() { }, reset() { } }; }
  const say = t => { msg.textContent = t || ""; msg.hidden = !t; };
  const paint = () => {
    const has = !!(blob || existing);
    play.hidden = !has; del.hidden = !has || !!rec;
    if (has) play.src = blob ? preview : existing;
    btn.textContent = rec ? "Arrêter" : has ? "Réenregistrer" : "Enregistrer";
    btn.classList.toggle("rec", !!rec);
  };
  const stop = () => { if (rec && rec.state !== "inactive") rec.stop(); clearInterval(timer); };
  btn.addEventListener("click", async () => {
    if (rec) return stop();
    say("");
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return say("Le micro n'est pas autorisé. Autorise-le dans ton navigateur, puis réessaie."); }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported?.(t)) || "";
    const chunks = [];
    rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); clearInterval(timer);
      const b = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }); rec = null;
      secs = Math.max(1, Math.min(MAX, Math.round((Date.now() - t0) / 1000)));
      if (b.size < 1500) { time.textContent = ""; say("Enregistrement trop court. Réessaie."); return paint(); }
      if (preview) URL.revokeObjectURL(preview);
      blob = b; preview = URL.createObjectURL(b); time.textContent = ""; say(""); paint();
    };
    rec.start(); t0 = Date.now(); paint();
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000); time.textContent = `${s} s / ${MAX} s`;
      if (s >= MAX) stop();
    }, 250);
  });
  del.addEventListener("click", () => { blob = null; existing = ""; exSec = 0; if (preview) URL.revokeObjectURL(preview); preview = ""; play.removeAttribute("src"); time.textContent = ""; paint(); });
  paint();
  return {
    blob: () => blob, existing: () => existing, seconds: () => blob ? secs : exSec,
    setExisting(u, sec) { blob = null; existing = u || ""; exSec = Number(sec) || 0; time.textContent = ""; say(""); paint(); },
    reset() { stop(); blob = null; existing = ""; if (preview) URL.revokeObjectURL(preview); preview = ""; time.textContent = ""; say(""); paint(); }
  };
}
