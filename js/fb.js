// Point d'entrée unique vers Firebase (v10, CDN officiel de Google).
// Chargement tolérant : si le réseau bloque le CDN, le site continue en mode démo au lieu de se bloquer.
import { firebaseConfig } from "./firebase-config.js";
const B = "https://www.gstatic.com/firebasejs/10.12.2/";
export const ready = !/COLLE_ICI/.test(firebaseConfig.apiKey || "COLLE_ICI");
let A = {}, S = {}, F = {};
if (ready) {
  try { [A, S, F] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]); }
  catch (e) { console.warn("Firebase indisponible", e); }
}
function no() { throw Object.assign(new Error("Pas de connexion à Firebase."), { code: "auth/network-request-failed" }); }
const g = (o, k) => o[k] || no;
export const app = A.initializeApp ? A.initializeApp(firebaseConfig) : null;
export const auth = app ? S.getAuth(app) : null;
export const db = app ? F.getFirestore(app) : null;
export const onAuthStateChanged = S.onAuthStateChanged || ((a, cb) => { cb(null); return () => {}; });
export const createUserWithEmailAndPassword = g(S, "createUserWithEmailAndPassword");
export const signInWithEmailAndPassword = g(S, "signInWithEmailAndPassword");
export const signOut = g(S, "signOut");
export const sendEmailVerification = g(S, "sendEmailVerification");
export const sendPasswordResetEmail = g(S, "sendPasswordResetEmail");
export const GoogleAuthProvider = g(S, "GoogleAuthProvider"), signInWithPopup = g(S, "signInWithPopup"), signInWithRedirect = g(S, "signInWithRedirect");
export const collection = g(F, "collection"), doc = g(F, "doc"), getDoc = g(F, "getDoc"), setDoc = g(F, "setDoc");
export const addDoc = g(F, "addDoc"), updateDoc = g(F, "updateDoc"), deleteDoc = g(F, "deleteDoc");
export const query = g(F, "query"), orderBy = g(F, "orderBy"), limit = g(F, "limit"), where = g(F, "where");
export const onSnapshot = g(F, "onSnapshot"), serverTimestamp = g(F, "serverTimestamp"), Timestamp = F.Timestamp || {};
