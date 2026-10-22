// ============================================================
//  À REMPLIR UNE SEULE FOIS (voir README.md, étapes 2 à 6)
// ============================================================

// Console Firebase > Paramètres du projet > Vos applications > Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyD1uI7s5-cnkL7sf3_2Xqwo5BxTGo3jEC0",
  authDomain: "sokoplus-6b1a0.firebaseapp.com",
  projectId: "sokoplus-6b1a0",
  storageBucket: "sokoplus-6b1a0.firebasestorage.app",
  messagingSenderId: "420850148374",
  appId: "1:420850148374:web:17d6d65cfa90f844ec0137"
};

// Notifications push quand le site est fermé (optionnel, voir README, option B)
// Console Firebase > Paramètres > Cloud Messaging > Certificats Web Push > Clé publique
export const VAPID_KEY = "";

// Photos des articles : compte gratuit sur cloudinary.com (sans carte bancaire)
export const CLOUDINARY = {
  cloudName: "dqtu9carq",
  uploadPreset: "sokosplus"
};

export const SITE = {
  contactEmail: "ebenjoshtechservices@gmail.com",
  contactPhone: "+243 845 289 561",
  name: "SokoPlus",
  adminWhatsapp: "243845289561", // ton numéro WhatsApp (les vendeurs t'écrivent pour s'abonner)
  adminEmail: "joshmukandirwa@gmail.com", // compte administrateur (connexion Google ou e-mail)
  notifyUrl: "https://script.google.com/macros/s/AKfycbwDZK7m02OPP6PnNOObc8INMgCyhE0gskTzz4yAomSgcLJ3usUGAUBIVSMapGjyUqfJmg/exec",                 // adresse du script e-mail (voir apps-script/notify.gs), laisse vide pour désactiver
  subscriptionText: "5 $ par mois",
  cities: ["Kinshasa", "Lubumbashi", "Goma", "Bukavu", "Kisangani", "Mbuji-Mayi", "Kolwezi", "Likasi", "Matadi", "Butembo", "Uvira", "Kananga", "Tshikapa", "Bunia", "Mbandaka", "Beni", "Kalemie", "Autre ville"],
  categories: ["Mode", "Alimentation", "Électronique", "Maison", "Beauté", "Artisanat", "Immobilier", "Services", "Autre"]
};
