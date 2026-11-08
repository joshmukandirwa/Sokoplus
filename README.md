# SokoPlus – guide de mise en ligne

Marché en ligne pour Goma : chaque vendeur crée son compte (email + téléphone + nom de boutique), publie ses articles (photos, nom, description, adresse, prix), et **tous les visiteurs voient le nouvel article apparaître en direct**. Les clients commandent sur WhatsApp et règlent le vendeur directement, selon les règles de sa boutique.

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
- Ensuite il te paie (ex. 5 $/mois) par le moyen que vous avez convenu, tu ouvres `admin.html` > Vendeurs > **+30 j**.
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

## Publication directe et suppression avec motif (étape 33)

- **Plus de validation** : tout vendeur actif publie son article en ligne tout de suite, et ses modifications aussi. Les règles de l'essai restent (2 publications par jour, places `postSlots` créées avec l'article, jamais réutilisables, même si l'article est supprimé).
- **Suppression par l'admin** : une fenêtre demande un **motif obligatoire** (choix rapides ou texte libre). Le vendeur reçoit un message « Ton article a été retiré » dans Ma boutique et dans la cloche, plus la notification push.
- Les anciennes propositions encore « en attente » restent visibles dans l'onglet « À valider » de l'admin.
- **Republie `firestore.rules`** après cette livraison (nouvelle collection `postSlots`, modification directe des articles par leur vendeur).

## Fonctionnalités uniques (étape 34) : « Propose ton prix »

- Chaque article a une case **Prix négociable** (cochée par défaut, champ `negotiable`). Les anciens articles restent négociables ; décoche la case pour afficher « Prix ferme ».
- Sur la page article, le bouton **Propose ton prix** ouvre un petit encart : réductions rapides (-5, -10, -15, -20 %) ou prix libre, calcul de l'économie, avertissement si l'offre est très basse. Le bouton envoie une offre polie, déjà rédigée, au vendeur sur WhatsApp. Aucun intermédiaire, aucune règle Firestore à ajouter pour ça.
- Republie `firestore.rules` : le champ `negotiable` y est autorisé.

## « Je cherche… » (étape 35)

- Nouvelle page `cherche.html` : un acheteur (ou un vendeur) connecté publie ce qu'il veut acheter (titre, détails, catégorie, ville, budget facultatif, prénom, numéro WhatsApp). La demande est en ligne tout de suite, sans validation, pendant 30 jours. 3 demandes par jour au maximum.
- Les vendeurs voient la liste (filtres par catégorie, recherche) et appuient sur « J'ai ça, je lui écris » : WhatsApp s'ouvre avec un message déjà rédigé. Le demandeur peut fermer sa demande avec « Je l'ai trouvé ».
- Admin : sur la page, le bouton « Supprimer » demande un motif obligatoire, envoyé au demandeur.
- Accès : lien « Je cherche » dans le menu du haut (ordinateur) et bouton dans la page de recherche quand rien n'est trouvé.
- **Alerte aux vendeurs** : à la publication, une notification push part aux vendeurs qui ont déjà des articles dans la même catégorie et le même pays (`/api/push`, type `want`). Les vendeurs doivent avoir activé les alertes dans Ma boutique. Redéploie sur Vercel pour mettre à jour `api/push.js`.
- Republie `firestore.rules` (nouvelle collection `wants`).

## Rencontre sûre et livraison (étape 37)

- Dans le formulaire d'article : **Lieu de rencontre sûr** (texte, 80 caractères) et case **Livraison possible**. Sur la page de l'article, l'acheteur voit « Rencontre sûre » (avec le conseil de se voir en journée dans un lieu public) et « Livraison possible ».
- Champs `meetPlace` et `delivery` : republie `firestore.rules`.

## Le troc (étape 38)

- Champ facultatif **« J'accepte l'échange contre… »** dans le formulaire article (`swapFor`, 80 caractères). La page article affiche « Échange accepté » avec un bouton **Proposer un échange** qui ouvre WhatsApp avec un message déjà rédigé.
- Republie `firestore.rules` (champ `swapFor` autorisé).

## La note vocale (étape 39)

- À l'étape « photos » du formulaire article, le vendeur enregistre jusqu'à 45 s avec son micro (bouton Enregistrer / Arrêter / Réécouter / Supprimer). Sur la page article, l'acheteur voit « Écoute le vendeur » avec un lecteur audio.
- L'audio part sur **Cloudinary** (`video/upload`) avec un **second préréglage `sokoplus_audio`**, pour que le préréglage des photos `sokosplus` reste limité aux images. **À créer dans Cloudinary** : Settings > Upload > Upload presets > Add upload preset. Nom : `sokoplus_audio`. Signing mode : **Unsigned**. Dossier conseillé : `notes-vocales`. Allowed formats : `webm, m4a, mp4, ogg, mp3, wav` (android et ordinateur enregistrent en webm, iPhone en m4a). Si l'envoi échoue, le message d'erreur de Cloudinary s'affiche chez le vendeur.
- `vercel.json` : le micro est maintenant autorisé (`microphone=(self)`), il était bloqué. Redéploie.
- Republie `firestore.rules` (champ `voice`, lien Cloudinary uniquement).

## Les achats groupés (étape 40)

- Formulaire article, bloc **Achat groupé** (facultatif) : prix de groupe, minimum de personnes (2 à 50), durée (3, 7 ou 14 jours). Champs `groupPrice`, `groupMin`, `groupDays`.
- Page article : encart avec la barre de progression (« 2 / 5 personnes »), le temps restant et le bouton **Je rejoins l'achat groupé** (compte gratuit, prénom et WhatsApp). Le premier qui rejoint lance le groupe. On peut quitter tant que le groupe est ouvert.
- Collection `groups/{idArticle}` (compteur) et `groups/{idArticle}/members/{uid}` (participants). **Seul le vendeur voit les numéros WhatsApp.**
- Ma boutique : bouton **Achat groupé** sur l'article, avec la liste des participants, un bouton WhatsApp par personne et **Relancer un nouveau groupe**.
- Le vendeur reçoit un message et une notification quand quelqu'un rejoint, et « Objectif atteint » quand le minimum est là (`/api/push`, type `group`).
- Le paiement et la remise restent entre le vendeur et les acheteurs, sur WhatsApp, comme le reste de SokoPlus.
- Republie `firestore.rules` et redéploie sur Vercel (`api/push.js`).

## Retouches (étape 43)

- **Note vocale** : vrai lecteur SokoPlus (bouton lecture/pause, barre de progression qu'on peut toucher pour avancer, durée). La durée enregistrée est stockée (`voiceSec`) parce que les fichiers webm enregistrés par le téléphone n'indiquent pas leur durée.
- **Cartes (promotions et listes)** : même hauteur, titre sur 2 lignes maximum, nom de boutique sur 1 ligne, lieu sur 2 lignes, avec « … » quand c'est trop long.
- **Certification** : le message vert a une croix qui le masque pour toujours sur cet appareil (`soko.certok.<uid>`). La boîte entière disparaît s'il n'y a rien d'autre dedans.
- **Favoris, boutiques suivies** : la photo de la boutique est recentrée (une marge négative venait de l'en-tête de boutique).
- **Je cherche…** : bouton pour effacer la recherche, photo de la boutique (ou du compte) sur la demande, bouton « Réactiver ma demande » si on a cliqué sur « Je l'ai trouvé » par erreur, demandes de ta ville d'abord (puis ton pays) avec l'étiquette « Près de toi », et alerte push aux appareils de la même ville (et aux vendeurs de la catégorie).
- Les appareils enregistrent maintenant leur pays et leur ville (`pushTokens.country` et `city`). Ils sont mis à jour quand la personne change de ville.
- **Annonces et communiqués** : images sans coins arrondis.
- Republie `firestore.rules` et redéploie sur Vercel.

## Modifier une annonce (étape 44)

- Admin > Annonces : bouton **Modifier** sur chaque annonce. On change le type, le titre, le message et **les images** : remplacer une image (↻), la retirer (×), la faire avancer (◀, la première est l'affiche principale) ou en ajouter (4 au maximum). La durée peut rester la même (« Garder ») ou repartir de zéro.
- Les compteurs de vues sont conservés. Aucune règle Firestore à changer (l'admin peut déjà modifier les annonces).

## Validation des articles et notifications (ancien fonctionnement)

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

- Dans « Ma boutique », **Modifier ma boutique** s'applique tout de suite, sans validation de l'admin : nom, numéro WhatsApp, photo de profil, photo de couverture, à propos, paiements, adresse, email et liens (collection publique `shops`). Pense à republier `firestore.rules`.
- Dans `admin.html`, onglet **À valider**, la demande montre l'ancien et le nouveau côte à côte. **Valider** met à jour la boutique, l'index de connexion par numéro et tous ses articles en ligne ; **Refuser** envoie un motif que la boutique voit.
- Republie `firestore.rules` : le nom ne peut plus être changé directement par le vendeur.

---

## Mise en ligne sur Vercel (adresse provisoire) et référencement (SEO)

1. **Vercel** : https://vercel.com, **Add New > Project**, importe le dépôt GitHub `Sokoplus`, laisse tous les réglages par défaut (pas de commande de build), puis **Deploy**. Chaque `git push` republie le site tout seul.
2. **Adresse** : le site est servi sur `https://sokoplus-africa.vercel.app` (si Vercel a donné une autre adresse, remplace-la partout, voir plus bas).
3. **Firebase** : Authentication > Paramètres > Domaines autorisés : ajoute `sokoplus-africa.vercel.app` (sinon la connexion Google est refusée en ligne).
4. **Apps Script** : dans ton script déployé, mets `SITE_URL = "https://sokoplus-africa.vercel.app"`.
5. **Google Search Console** : ajoute le site, puis envoie `https://sokoplus-africa.vercel.app/sitemap.xml`.

**Le jour où tu achètes `sokoplus.store`** : dans Vercel, Settings > Domains > ajoute le domaine et recopie les enregistrements DNS demandés chez ton vendeur. Puis, dans VS Code, Ctrl + Maj + H : remplace `sokoplus-africa.vercel.app` par `sokoplus.store` dans tout le projet, republie, ajoute `sokoplus.store` dans les domaines autorisés de Firebase et renvoie le sitemap à la Search Console.

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

- **Pas de paiement dans le site** : le client règle le vendeur directement, selon les règles de sa boutique. SokoPlus ne touche pas l'argent des ventes, seulement les abonnements.
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
