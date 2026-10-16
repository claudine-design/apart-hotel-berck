# SMS-Voyageurs — Guide d'installation pas à pas (Phase 1 : observation)

> Pour Claudine. Durée totale : environ 45 minutes, en 4 parties indépendantes.
> **En phase 1, le système n'envoie JAMAIS de SMS** : il classe, propose par e-mail, et journalise. C'est tout.

---

## Partie A — Le Google Sheet (5 min)

1. Aller sur [sheets.new](https://sheets.new) (avec le compte qui héberge le robot Booking).
2. Nommer le fichier : **« SMS-Voyageurs — Journal »**.
3. Copier son **ID** : dans l'adresse `https://docs.google.com/spreadsheets/d/`**`CECI_EST_L_ID`**`/edit`, prendre la partie entre `/d/` et `/edit`. La garder de côté.

## Partie B — Le script Apps Script (15 min)

1. Aller sur [script.google.com](https://script.google.com) → **« Nouveau projet »**.
2. Nommer le projet : **« SMS-Voyageurs »**.
3. Supprimer le contenu du fichier `Code.gs` affiché, et coller à la place **tout** le contenu du fichier `Code.gs` de ce dossier GitHub.
4. Ouvrir ⚙️ **« Paramètres du projet »** → section **« Propriétés du script »** → ajouter ces propriétés :

| Propriété | Valeur |
|---|---|
| `SHEET_ID` | l'ID noté en partie A |
| `KB_SHEET_ID` | l'ID du Sheet du robot Booking (celui qui contient l'onglet KB) — *je peux te le retrouver si besoin* |
| `BEDS24_READ_REFRESH_TOKEN` | un **nouveau** token Beds24 en **lecture seule** (voir encadré ci-dessous) |
| `ANTHROPIC_API_KEY` | la même clé Claude que le robot Booking (à copier depuis ses propriétés) |
| `DIGEST_EMAILS` | `claudine.podvin@gmail.com,princessedopale@gmail.com` |
| `CALLMEBOT_PHONE` / `CALLMEBOT_APIKEY` | (facultatif) mêmes valeurs que le robot Booking pour l'alerte WhatsApp |

> **Token Beds24 lecture seule** (méthode validée à l'installation du 24/07/2026) :
> dans Beds24 → Marketplace → API, le bouton « Generate long life token » **ne convient PAS**
> (ce n'est pas un refresh token → HTTP 401). Il faut **« Generate invite code »** avec
> droits **READ uniquement** (aucun write/delete), puis échanger ce code via
> `GET /v2/authentication/setup` (en-tête `code`) pour obtenir le `refreshToken`,
> à stocker dans la propriété `BEDS24_READ_REFRESH_TOKEN`.

5. Dans la barre d'outils, choisir la fonction **`setup`** puis ▶ **Exécuter**. Autoriser les accès demandés (Sheets, Gmail, contacts extérieurs). Ouvrir « Journal d'exécution » : noter la ligne **`SECRET_SMS`** affichée (on en aura besoin pour MacroDroid).
6. Choisir la fonction **`installerTriggers`** puis ▶ **Exécuter** (met en place le résumé de 20h30 et la veille du téléphone).
7. **Déployer** : bouton bleu « Déployer » → « Nouveau déploiement » → type **« Application Web »** → Exécuter en tant que : **Moi** → Accès : **Tout le monde disposant du lien** → Déployer. **Copier l'URL** qui se termine par `/exec`.

✅ Vérification : ouvrir dans le navigateur `URL_EXEC?k=SECRET_SMS` (remplacer par tes valeurs) → tu dois voir `{"mode":"OBSERVATION",...}`.

## Partie C — MacroDroid sur le téléphone (20 min)

### C.1 Installation
1. Play Store → **MacroDroid** → installer (gratuit pour ce test ; la version Pro ~6 € sera utile quand on aura plus de 5 macros).
2. À l'ouverture : autoriser **SMS** et **Contacts**, et accepter **« Ignorer l'optimisation de la batterie »** quand l'application le propose (indispensable).

### C.2 Les listes locales (le cœur de la confidentialité)
Menu → **Variables** → « + » :
- `TRANSMISSION_ACTIVE` — type **Booléen** — valeur **Vrai** *(ton interrupteur général côté téléphone)* ;
- `EXCLUS` — type **Dictionnaire** *(famille, amis, banquier, comptable… : clé = numéro au format +33…, valeur = 1)* ;
- `PRO_AUTORISES` — type **Dictionnaire** *(clé = numéro +33…, valeur = catégorie : `prestataire_menage`, `artisan`, `plombier`…)* ;
- `CNT_PERSO`, `CNT_COURTS`, `CNT_TRANSMIS` — type **Entier**, valeur 0 *(compteurs du résumé du soir)*.

*On remplira EXCLUS et PRO_AUTORISES ensemble — prévois ta liste de numéros pro (prestataires, artisans).*

### C.3 Macro 1 — « SMS → Robot » (réception)
- **Déclencheur** : SMS reçu → Depuis : **N'importe quel numéro**.
- **Actions** (dans cet ordre, avec des blocs Si/Fin si) :
  1. **Si** `TRANSMISSION_ACTIVE` = Faux → **Arrêter la macro**.
  2. **Si** `{sms_number}` **ne correspond pas** à l'expression régulière `^(\+|00)?[0-9]{10,15}$` *(numéro court ou expéditeur alphanumérique : banques, codes, pubs)* → `CNT_COURTS` +1 → **Arrêter**.
  3. **Si** `{sms_message}` contient (regex) `(?i)(code de connexion|code de v[ée]rification|ne partagez|OTP|mot de passe)` → `CNT_COURTS` +1 → **Arrêter**.
  4. **Si** la clé `{sms_number}` existe dans `EXCLUS` → `CNT_PERSO` +1 → **Arrêter**.
  5. **Si** `{sms_contact_name}` n'est **pas vide** ET la clé `{sms_number}` n'existe **pas** dans `PRO_AUTORISES` *(contact connu mais pas professionnel = personnel)* → `CNT_PERSO` +1 → **Arrêter**.
  6. **Action « Requête HTTP »** : méthode **POST**, URL = l'URL `/exec` de la partie B, type de contenu `application/json`, corps :
     ```json
     {"secret":"SECRET_SMS_ICI","action":"sms","numero":"{sms_number}","texte":"{sms_message}","contact_connu":"{sms_contact_name}",
      "categorie_locale":"[valeur de PRO_AUTORISES pour {sms_number}, vide si absent]","id_appareil":"tel-claudine"}
     ```
     Options : **enregistrer le code de retour HTTP** dans une variable `HTTP_CODE`.
  7. `CNT_TRANSMIS` +1.
  8. **Si** `HTTP_CODE` ≠ 200 → **Notification** « ⚠️ Robot SMS injoignable » *(le SMS reste sur le téléphone, rien n'est perdu)*.

### C.4 Macro 2 — « Signal de vie » (toutes les heures)
- **Déclencheur** : Intervalle régulier → toutes les **60 minutes**.
- **Action** : Requête HTTP POST vers la même URL, corps :
  ```json
  {"secret":"SECRET_SMS_ICI","action":"heartbeat",
   "compteurs":{"perso":{lv=CNT_PERSO},"courts":{lv=CNT_COURTS},"transmis":{lv=CNT_TRANSMIS},
   "bloques_total":{lv=CNT_PERSO+CNT_COURTS}}}
  ```
- **Macro 2b (minuit)** : Déclencheur Jour/Heure 00:05 → remettre `CNT_PERSO`, `CNT_COURTS`, `CNT_TRANSMIS` à 0.

### C.5 L'interrupteur d'urgence
Écran d'accueil Android → appui long → Widgets → **MacroDroid** → bouton qui bascule `TRANSMISSION_ACTIVE` Vrai/Faux. Un appui = plus aucune transmission.

## Partie D — Tests de réception (10 min)

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Depuis un autre téléphone **inconnu de tes contacts** : « Bonjour, nous arrivons à 17h » | Ligne dans l'onglet Journal + e-mail « 📱 SMS : 1 proposition à valider » (texte type S2 si le numéro n'est pas dans Beds24) |
| 2 | Le même SMS renvoyé dans les 10 min | Rien (anti-doublon) — vérifiable dans l'onglet Log |
| 3 | SMS depuis un numéro mis dans `EXCLUS` | **Rien ne part du téléphone** ; `CNT_PERSO` augmente |
| 4 | SMS « test code de vérification 123456 » depuis un numéro inconnu | Bloqué localement ; `CNT_COURTS` augmente |
| 5 | Numéro d'une **vraie réservation test** Beds24 : « Nous arrivons à 17h » | Journal : catégorie `voyageur_reconnu`, logement et dates remplis, proposition type S1 |
| 6 | « Je suis bloqué devant la porte, le code ne marche pas » depuis un numéro inconnu | 🚨 E-mail d'alerte urgence ; la proposition **ne contient aucun code** |
| 7 | Widget `TRANSMISSION_ACTIVE` sur Faux + un SMS de test | Rien ne part ; compteur inchangé |
| 8 | Attendre le soir | Résumé quotidien à ~20h30 avec les bons comptages |

## En cas de problème

- **Rien n'arrive dans le Sheet** : vérifier l'URL `/exec` et le `SECRET_SMS` dans la macro ; tester `URL?k=SECRET` dans le navigateur ; regarder l'onglet Log.
- **Alerte « Téléphone muet »** reçue à tort : vérifier que la macro « Signal de vie » est activée et que MacroDroid est exclu de l'optimisation batterie.
- **Tout couper** : widget `TRANSMISSION_ACTIVE` = Faux (téléphone) — et/ou `MODE` reste sur OBSERVATION (Sheet, onglet Config).

## Mise à jour v1.1 (transparence des analyses) — après les premiers tests

La version 1.1 du `Code.gs` (dans ce dépôt) ajoute dans chaque proposition et dans le résumé :
la réservation retrouvée en clair, l'ambiguïté si plusieurs réservations partagent le numéro,
et l'explication courte du score de confiance. Pour l'activer :

1. Ouvrir le projet « SMS-Voyageurs » → remplacer tout `Code.gs` par la version du dépôt.
2. Dans le Sheet, onglet Journal : ajouter l'en-tête `explication` dans la première cellule vide
   de la ligne 1 (colonne U) — ou, si le Journal est encore vide, supprimer l'onglet et relancer `setup()`.
3. « Déployer → Gérer les déploiements → ✏️ Modifier → Version : Nouvelle version → Déployer »
   (l'URL /exec ne change pas, MacroDroid n'est pas à modifier).

## Retour arrière complet

Désactiver les 2 macros MacroDroid (ou désinstaller l'application). Le robot Booking n'est pas concerné : aucun de ses fichiers, déploiements ou déclencheurs n'a été touché.
