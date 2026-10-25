# SokoPlus – guide de mise en ligne

Marché en ligne pour Goma : chaque vendeur crée son compte (email + téléphone + nom de boutique), publie ses articles (photos, nom, description, adresse, prix), et **tous les visiteurs voient le nouvel article apparaître en direct**. Les clients commandent sur WhatsApp et paient en Mobile Money directement au vendeur.

## Ce qui est inclus

| Fichier | Rôle |
|---|---|
| `index.html` | Le marché : recherche, filtres, favoris, fiche article, USD/FC, alertes en direct |
| `vendeur.html` | Espace vendeur : inscription, connexion (email **ou** téléphone), publier / modifier / supprimer / marquer vendu |
| `admin.html` | Toi : prolonger les abonnements, bloquer un vendeur, mettre un article à la une, traiter les signalements |
| `firestore.rules` | Sécurité : chacun ne modifie que ses propres articles |
| `functions/` | (Option B) notifications push quand le site est fermé |
| `firebase-messaging-sw.js`, `manifest.json` | Installation sur l'écran d'accueil et notifications |

Sans configuration, `index.html` s'ouvre en **mode démo** avec des articles d'exemple.

## Comment tu gagnes de l'argent

- Chaque nouveau vendeur a **30 jours gratuits** (automatique).
- Ensuite il te paie (ex. 5 $/mois) en Mobile Money, tu ouvres `admin.html` > Vendeurs > **+30 j**.
- Un vendeur expiré ne peut plus publier (ses anciens articles restent visibles tant que tu ne les retires pas).
- **Mise à la une** : tu peux faire payer les vendeurs pour que leur article apparaisse en premier (Admin > Articles > Mettre à la une).

---

## Mise en place (environ 30 minutes, tout est gratuit)

### Étape 1. Créer le projet Firebase
1. Va sur https://console.firebase.google.com et connecte-toi avec ton compte Google.
2. **Ajouter un projet**, nom : `sokoplus`. Tu peux refuser Google Analytics.

### Étape 2. Récupérer la configuration du site
1. Dans le projet : roue dentée > **Paramètres du projet** > **Vos applications** > icône **`</>`** (Web).
2. Nom de l'app : `sokoplus-web`. Ne coche pas « Firebase Hosting » pour l'instant.
3. Copie les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` dans **`js/firebase-config.js`**.

### Étape 3. Activer la connexion par email
Menu **Authentication** > **Commencer** > **Adresse e-mail / Mot de passe** > Activer > Enregistrer.
(Plus tard, quand ton site a une adresse, ajoute-la dans Authentication > Paramètres > **Domaines autorisés**.)

### Étape 4. Créer la base de données et coller les règles
1. Menu **Firestore Database** > **Créer une base de données**. Emplacement : **`eur3 (Europe)`**, mode **production**.
2. Onglet **Règles** : efface tout, colle le contenu de **`firestore.rules`**, clique **Publier**.

### Étape 5. Les photos (Cloudinary, sans carte bancaire)
Firebase Storage demande maintenant une carte bancaire. Cloudinary est gratuit (25 Go) et sert aussi des miniatures légères, idéal pour les connexions lentes.
1. Crée un compte sur https://cloudinary.com.
2. Note ton **Cloud name** (en haut du tableau de bord).
3. **Settings** (roue dentée) > **Upload** > **Upload presets** > **Add upload preset** : *Signing mode* = **Unsigned**, *Folder* = `soko`, puis enregistre. Note le **nom du preset**.
4. Colle `cloudName` et `uploadPreset` dans **`js/firebase-config.js`**.

### Étape 6. Mettre le site en ligne
Le plus simple : **Firebase Hosting** (gratuit).
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # choisis ton projet sokoplus
firebase deploy --only hosting,firestore:rules
```
Ton site sera sur `https://sokoplus.web.app`. Ajoute ce domaine dans Authentication > Paramètres > Domaines autorisés si ce n'est pas déjà fait.
(Autre solution sans terminal : glisser le dossier sur https://app.netlify.com/drop, puis ajouter le domaine Netlify dans Domaines autorisés.)

### Étape 7. Devenir administrateur
1. Ouvre `vendeur.html` sur ton site et **crée un compte** avec ton email. Vérifie l'email (lien reçu).
2. Console Firebase > **Authentication** > **Utilisateurs** : copie ton **UID**.
3. **Firestore** > **Démarrer une collection** : ID `admins`, ID du document = **ton UID**, ajoute un champ `ok` (booléen, `true`).
4. Ouvre `admin.html` : connecte-toi avec le même email.

Pense aussi à mettre **ton numéro WhatsApp** dans `SITE.adminWhatsapp` (`js/firebase-config.js`) : c'est le bouton « Écrire sur WhatsApp » que voient les vendeurs expirés.

### Étape 8. Tester
Crée un 2ᵉ compte vendeur (autre email, autre téléphone), publie un article avec photo. Ouvre `index.html` sur un autre appareil : l'article apparaît tout seul, avec une alerte en bas.

---

## Validation des articles et notifications

- Un vendeur qui publie envoie une **proposition** (collection `submissions`). Elle n'est visible que par lui et par l'admin.
- L'admin ouvre `admin.html`, onglet **À valider**, et clique **Valider** (l'article apparaît pour tout le monde) ou **Refuser** (avec un motif que le vendeur voit).
- Le compte administrateur est `SITE.adminEmail` (js/firebase-config.js) : connexion avec Google ou e-mail, sans créer de document `admins`. Pense à republier `firestore.rules`.
- Notifications dans l'appli : l'admin voit un message et un compteur à chaque nouvelle proposition, le vendeur voit un message quand son article est validé ou refusé (page ouverte).
- Notifications par e-mail (gratuit) : colle `apps-script/notify.gs` dans https://script.google.com, déploie-le en application Web, puis mets l'adresse obtenue dans `SITE.notifyUrl`.

---

## Essai gratuit, abonnement et limites

- Un nouveau compte est en **essai gratuit** (plan `essai`) pendant 30 jours : **2 publications par jour**. Le temps restant s'affiche en direct dans « Ma boutique ».
- Après 30 jours, le compte est bloqué avec un message qui propose de passer à la version complète sur WhatsApp.
- Dans `admin.html`, onglet **Vendeurs** : toutes les boutiques sont listées (Essai ou Abonné). **Abonner 30 j / 90 j** passe la boutique en plan `pro` (publications illimitées) et prolonge sa date. **Bloquer / Débloquer** suspend ou réactive la boutique.
- Chaque photo fait 4 Mo maximum.
- La limite de 2 par jour est vérifiée par `firestore.rules` : republie les règles après chaque livraison.

---

## Notifications, suggestions et espace admin

- Une **cloche** apparaît dans l'en-tête (accueil, catégories, favoris, recherche) : badge des articles non lus, liste des derniers articles et **suggestions** basées sur tes favoris et tes recherches. L'accueil affiche aussi « Suggestions pour toi » dès que le visiteur a des favoris ou des recherches.
- Ces notifications fonctionnent site ouvert. Pour être alerté site fermé, il faut l'option push (Option B ci-dessous, forfait Blaze).
- `admin.html` : tableau de bord avec compteurs, recherche, filtres (Essai, Abonnées, Expirées, Bloquées) et cartes de boutiques avec temps restant.
- Le compte admin et un compte vendeur partagent la même session dans un même navigateur : pour tester les deux, utilise deux navigateurs ou une fenêtre privée.

---

## Modifier sa boutique (nom, numéro, photo)

- Dans « Ma boutique », **Modifier ma boutique** envoie une demande (collection `profileRequests`). Rien ne change tant que l'admin n'a pas validé.
- Dans `admin.html`, onglet **À valider**, la demande montre l'ancien et le nouveau côte à côte. **Valider** met à jour la boutique, l'index de connexion par numéro et tous ses articles en ligne ; **Refuser** envoie un motif que la boutique voit.
- Republie `firestore.rules` : le nom ne peut plus être changé directement par le vendeur.

---

## Mise en ligne sur Vercel (adresse provisoire) et référencement (SEO)

1. **Vercel** : https://vercel.com, **Add New > Project**, importe le dépôt GitHub `Sokoplus`, laisse tous les réglages par défaut (pas de commande de build), puis **Deploy**. Chaque `git push` republie le site tout seul.
2. **Adresse** : le site est servi sur `https://sokoplus-rdc.vercel.app` (si Vercel a donné une autre adresse, remplace-la partout, voir plus bas).
3. **Firebase** : Authentication > Paramètres > Domaines autorisés : ajoute `sokoplus-rdc.vercel.app` (sinon la connexion Google est refusée en ligne).
4. **Apps Script** : dans ton script déployé, mets `SITE_URL = "https://sokoplus-rdc.vercel.app"`.
5. **Google Search Console** : ajoute le site, puis envoie `https://sokoplus-rdc.vercel.app/sitemap.xml`.

**Le jour où tu achètes `sokoplus.store`** : dans Vercel, Settings > Domains > ajoute le domaine et recopie les enregistrements DNS demandés chez ton vendeur. Puis, dans VS Code, Ctrl + Maj + H : remplace `sokoplus-rdc.vercel.app` par `sokoplus.store` dans tout le projet, republie, ajoute `sokoplus.store` dans les domaines autorisés de Firebase et renvoie le sitemap à la Search Console.

Le projet contient : titres et descriptions par page, adresses canoniques, balises de partage (Open Graph et Twitter) avec `icons/og-image.png`, données structurées sur l'accueil, `robots.txt`, `sitemap.xml` et `vercel.json`. Les pages Recherche, Favoris, Paramètres et Admin sont en `noindex`.
---

## Option B : notifications push (site fermé)

Sans cette option, les visiteurs voient les nouveaux articles **en direct tant que le site est ouvert** (onglet ouvert ou appli installée). Pour alerter aussi ceux qui ont fermé le site, il faut une fonction serveur, et Firebase la réserve au forfait **Blaze** (carte bancaire demandée, à ton volume tu ne paies rien).

1. Console Firebase > **Mettre à niveau** vers Blaze (tu peux fixer un budget d'alerte à 1 $).
2. **Paramètres du projet** > **Cloud Messaging** > **Certificats Web Push** > **Générer une paire de clés**. Colle la **clé publique** dans `VAPID_KEY` (`js/firebase-config.js`).
3. Dans `functions/`, copie `.env.example` en `.env` et mets l'adresse de ton site.
4. ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions,hosting
   ```
5. Chaque visiteur touche la cloche du site, choisit « tous les articles » ou certaines catégories, et accepte. Sur iPhone, il faut d'abord « Ajouter à l'écran d'accueil ».

---

## Sécurité et limites à connaître

- **Pas de paiement dans le site** : le client paie le vendeur directement en Mobile Money, après accord sur WhatsApp. SokoPlus ne touche pas l'argent des ventes, seulement les abonnements.
- **Modération** : chaque article a un bouton « Signaler ». Tu traites les signalements dans `admin.html` et tu peux bloquer un vendeur en un clic.
- **Email vérifié obligatoire** pour publier (anti-spam). Le vendeur reçoit un lien à la création du compte et peut le renvoyer.
- **Connexion par téléphone** : le numéro sert d'identifiant, un petit index `numéro > email` est lisible une adresse à la fois. Seule une personne connaissant déjà le numéro peut en déduire l'email. Si tu ne veux pas de ça, supprime la connexion par téléphone dans `js/vendor.js`.
- **Pas de code SMS** : le numéro est demandé mais pas vérifié par SMS (les SMS Firebase sont payants). Les articles affichent le numéro tel qu'il est saisi.
- Les photos supprimées restent chez Cloudinary (non signé) : c'est sans conséquence avec 25 Go gratuits.
- Le taux USD/FC est dans `js/firebase-config.js` (`SITE.rate`).
- Le site a été testé au chargement avec une simulation de Firebase, **pas avec un vrai projet**. Si une étape coince, note le message d'erreur exact (console du navigateur, touche F12) et envoie-le moi.

---

## Pages et fonctions ajoutées (version 1.0.0)

| Fichier | Rôle |
|---|---|
| `recherche.html` | Recherche en direct (sans accents), filtres, recherches récentes, filtre par boutique (`?shop=`) |
| `categories.html` | Grandes tuiles par catégorie, puis les articles de la catégorie choisie (`?c=Mode`) |
| `favoris.html` | Tes favoris, même sans connexion, avec « Tout vider » |
| `parametres.html` | Apparence clair / sombre / automatique, langue FR / EN, devise, notifications, installation, mises à jour, à propos |
| `offline.html`, `service-worker.js` | Fonctionnement hors connexion et mise à jour automatique (augmente `VERSION` dans `service-worker.js` à chaque nouvelle livraison) |
| `js/ui.js` | En-tête, barre du bas, animations, protections (pas d'appui long pour télécharger les images, pas de sélection de texte), vérification du compte avant de vendre |

Le bouton **Vendre** vérifie la connexion : un visiteur sans compte voit une fenêtre « Vérifiez votre compte vendeur » avec deux choix (connexion ou création de boutique).
