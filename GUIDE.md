# Guide – Pressing Fanico Moderne

Application de reçus numériques de pressing : **un seul fichier `index.html`, sans serveur, sans npm**.
Les données sont stockées dans `data.md` sur GitHub.

---

## Liens de l'application

| Pour qui | Lien |
|---|---|
| **Clients** (accueil) | `https://<compte>.github.io/<depot>/` → le client colle son lien de reçu |
| **Administrateur** | `https://<compte>.github.io/<depot>/#/gestion-fanico` — mot de passe `F@nic0` |
| **Suivi d'une commande** | `https://<compte>.github.io/<depot>/#/suivi/<id>` — toujours le même lien, il se met à jour tout seul |

> L'accueil ne montre aucun lien admin : gardez `#/gestion-fanico` pour vous.

---

## Fonctionnement sans serveur

- `index.html` est **autonome** : React, la carte (Leaflet) et le logo sont embarqués dedans.
  → **Double-cliquez dessus**, il fonctionne aussi en local, comme l'appli « reçu ».
- Le navigateur lit et écrit `data.md` **directement sur GitHub** (API GitHub). Aucun serveur à lancer.
- **Internet est nécessaire** pour enregistrer/lire les commandes et afficher la carte.
- Les liens clients pointent **toujours vers l'adresse publique GitHub Pages**, même s'ils sont créés
  depuis le fichier local (le client ne peut pas ouvrir un fichier de votre PC).
- La page client se rafraîchit **toute seule** (chaque minute et quand on revient sur l'onglet).
  Délai d'apparition d'une modification : **≈ 1 minute**.

---

## Mise en ligne (une seule fois)

### 1. Créer le dépôt GitHub
1. Créez un compte sur https://github.com puis **New repository** (ex. `fanico`), visibilité **Public**.
2. **Add file → Upload files** : envoyez **`index.html`** et **`data.md`** (le reste est facultatif).

### 2. Activer GitHub Pages
**Settings → Pages → Source : Deploy from a branch → `main` / `(root)` → Save.**
Le site sera disponible à `https://<compte>.github.io/fanico/` après 1–2 minutes.

### 3. Créer le jeton (token) administrateur
1. Allez sur https://github.com/settings/personal-access-tokens/new (*Fine-grained token*).
2. **Repository access** : *Only select repositories* → `fanico`.
3. **Permissions → Repository permissions → Contents : Read and write**.
4. Expiration : la plus longue possible. Copiez le jeton `github_pat_…`.

### 4. Première connexion admin (une fois par appareil)
1. Ouvrez le lien admin (`…/#/gestion-fanico`) ou `index.html` en local + `#/gestion-fanico`.
2. Mot de passe : `F@nic0`.
3. Renseignez **compte GitHub**, **dépôt**, **branche** (`main`), **jeton**.
   *Adresse publique* : facultatif (déduite automatiquement de `https://<compte>.github.io/<depot>/`).
4. **Tester et enregistrer**. À refaire sur chaque téléphone / PC utilisé.

---

## Tester en local (sans serveur)
1. Double-cliquez sur `index.html` → page d'accueil client.
2. Ajoutez `#/gestion-fanico` à la fin de l'adresse → espace admin.
3. Configurez GitHub (étape 4 ci-dessus), créez une commande → elle s'écrit dans `data.md` sur GitHub.
4. Bouton **Ouvrir** sur la commande → vue client (lien public GitHub Pages).

---

## Utilisation administrateur
- **Nouvelle commande** : lavage / repassage / récupération-livraison (un seul service, un seul prix), kg, prix,
  à payer = lavage + repassage + récupération-livraison (calcul auto, modifiable), déjà payé,
  reste à payer (auto), nom, contact, dates de dépôt et de retrait.
- **Détails** : bouton **＋ Nouveau détail** pour chaque ligne (ex. « 2 draps blancs »), ✕ pour supprimer.
- **Carte** : cliquez pour placer le client, déplacez le marqueur pour mettre à jour,
  **🧭 Itinéraire** ouvre Google Maps pour la livraison.
- **Référence de commande** (`CMD-2026-00001`) : attribuée automatiquement et unique pour chaque commande
  (visible sur le reçu, la liste, la recherche et `data.md`).
- **Code client** (`FN-XXXXXX`) — différent de la référence : sert seulement à retrouver le client : **⚙️ Générer un code** ; il reste valable même après suppression
  de la commande. Pour un client qui revient : saisir le code → **🔎 Récupérer** (nom, contact, position).
  Impossible de régénérer un code sur des infos récupérées via un code.
  La position remonte aussi. Si vous modifiez nom / contact / position dans la commande, c'est enregistré sur le même code.
- **👥 Clients** : liste des codes clients ; cliquez sur un client pour modifier nom, contact et position
  → **Enregistrer sur ce code** (met aussi à jour ses commandes en attente).
- **Statut** : ⏳ En attente → ✔ Terminé (payé + habits reçus). Bouton **Marquer terminé** = solde payé.
- **Lien client** : 📋 Copier, **WhatsApp**, 🖨️ Imprimer. Le lien ne change jamais.

---

## Où sont les données ?
- Dans **`data.md`** du dépôt GitHub : tableaux lisibles (commandes, codes clients) + bloc JSON
  utilisé par l'application (**ne pas modifier le JSON à la main**).
- Chaque enregistrement crée un commit → historique complet des modifications.
- Pour le récupérer sur le PC : bouton **Code → Download ZIP** sur GitHub, ou `git pull`.

---

## Modifier l'application (développeur)
| Fichier | Rôle |
|---|---|
| `src/app.jsx` | Code de l'application (React) |
| `src/styles.css` | Styles (bleu et blanc, responsive) |
| `assets/logo.png` | Logo embarqué |
| `vendor/` | React, Leaflet, icônes de carte, Babel (outil de build uniquement) |
| `build.mjs` | Assemble tout dans `index.html` |

Après une modification : `node build.mjs`, puis renvoyez le nouveau `index.html` sur GitHub.

---

## À savoir
- Dépôt **public** (obligatoire pour GitHub Pages gratuit) : `data.md` est lisible par tous
  (noms, téléphones, positions des clients).
- Le mot de passe admin est dans le code : la vraie protection est le **jeton GitHub**.
- **Ne partagez jamais le jeton.** S'il fuit : supprimez-le sur GitHub et créez-en un nouveau.
- Contact du pressing : **0709405059**.
