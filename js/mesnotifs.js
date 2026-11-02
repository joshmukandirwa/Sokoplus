// Messages de SokoPlus pour le vendeur connecté (certification approuvée ou refusée...). En direct, sans serveur.
import { auth, db, onAuthStateChanged, doc, updateDoc, deleteDoc, collection, query, where, limit, onSnapshot } from "./fb.js";
import { toast, linkPush } from "./common.js";

export const ms = n => n.createdAt?.toMillis?.() ?? Date.now();
let list = [], started = false, first = true, off = null;
const subs = new Set();
const emit = () => subs.forEach(f => { try { f(list); } catch { /* un abonné en panne ne bloque pas les autres */ } });

export const myNotifs = () => list;
export const unread = () => list.filter(n => !n.read);

function start() {
  if (started || !auth) return; started = true;
  onAuthStateChanged(auth, u => {
    off && off(); off = null; list = []; first = true; emit();
    if (!u) return;
    linkPush(u);
    off = onSnapshot(query(collection(db, "userNotifs"), where("uid", "==", u.uid), limit(30)), s => {
      list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b) - ms(a));
      if (!first) s.docChanges().forEach(c => { if (c.type === "added" && !c.doc.metadata.hasPendingWrites && !c.doc.data().read) toast(c.doc.data().title || "Message de SokoPlus"); });
      first = false; emit();
    }, () => { /* lecture impossible : on n'affiche simplement rien */ });
  });
}
export function onMyNotifs(cb) { subs.add(cb); start(); cb(list); return () => subs.delete(cb); }
export const markRead = ids => Promise.all(ids.map(id => updateDoc(doc(db, "userNotifs", id), { read: true }).catch(() => { })));

export const removeNotifs = ids => Promise.all(ids.map(id => deleteDoc(doc(db, "userNotifs", id)).then(() => true).catch(() => false)));
