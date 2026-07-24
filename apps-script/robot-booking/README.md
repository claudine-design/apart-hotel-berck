# Robot Booking (guest response bot) — copie d'archive du projet Apps Script

> Copie **lecture seule** du projet Apps Script en production « **Robot Messages Booking** »
> (celui qui envoie les e-mails « 🤖 proposition(s) de réponse Booking à valider »).
> Fournie à la session Claude Code pour réutiliser ses briques dans le futur script
> séparé « SMS-Voyageurs ». **Rien n'a été modifié ni redéployé côté production.**

## Contenu du projet Apps Script (2 fichiers, tels quels dans l'éditeur)

| Fichier | Rôle |
|---|---|
| `Code.gs` | Tout le backend : scan cloud Beds24, appels Claude, envoi Beds24, calendrier, API de l'interface. |
| `Interface.html` | Page mobile de validation servie par `doGet(?k=SECRET)` (template Apps Script). |

## ⚠️ Secrets — ce dépôt est PUBLIC

Aucune vraie valeur de secret n'est présente dans ces fichiers. Les seules valeurs
sensibles qui étaient codées en dur ont été remplacées par des placeholders et
déplacées vers les **Script Properties** :

- `SHEET_ID` → `<SHEET_ID_DANS_PROPRIETES_DU_SCRIPT>` (lu depuis la Script Property `SHEET_ID`)
- destinataires du digest → `<EMAIL_DESTINATAIRE_1>,<EMAIL_DESTINATAIRE_2>` (Script Property `DIGEST_EMAILS`)

Tous les autres secrets étaient **déjà** lus depuis les Script Properties dans le code
d'origine (jamais en dur) : `SECRET`, `BEDS24_WRITE_REFRESH_TOKEN`, `ANTHROPIC_API_KEY`,
`CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY`, `CALENDRIER_DRAPS`.

## Script Properties utilisées (noms seulement)

| Nom | Usage |
|---|---|
| `SECRET` | Jeton du webhook `?k=` / `secret=` (auth de toutes les routes). |
| `SHEET_ID` | ID du Google Sheet de données (onglets Propositions/Historique/Log/KB/ScanState). |
| `BEDS24_WRITE_REFRESH_TOKEN` | Refresh token Beds24 **écriture** (envoi + marquer-lu). Séparé du token lecture du robot local. |
| `ANTHROPIC_API_KEY` | Clé API Claude (génération, reformulation, traduction). |
| `CALLMEBOT_PHONE` / `CALLMEBOT_APIKEY` | Alerte WhatsApp d'urgence via CallMeBot (facultatif ; vide = e-mail seul). |
| `DIGEST_EMAILS` | Destinataires des e-mails digest + alertes (séparés par des virgules). |
| `CALENDRIER_DRAPS` | (facultatif) nom du calendrier ; défaut « DRAP/ CHECK IN-OUT ». |
| `SCAN_SEEDED` | Drapeau interne posé au 1er passage (seed) — ne pas créer à la main. |

## Points de réutilisation pour « SMS-Voyageurs »

- **Style Claudine + génération** : `SYS_SCAN_GEN` + `claudeGeneration_()` (fiches KB + historique).
- **Reformulation dictée** : `SYS_REFORMULER` + `apiReformuler()`.
- **Traduction à l'envoi** : `traduireDepuisFr()`.
- **Accès Beds24** : `beds24TokenEcriture()`, `envoyerBeds24()`, `marquerConversationLue()`.
- **Interface de validation** : `doGet`/`doPost` + `Interface.html` (list / valider / rejeter / reformuler / marquerLu).
- **Détection urgence** : `SYS_SCAN_URGENCE` + `claudeUrgence_()` + `alerteUrgenceCloud_()`.

⚠️ Le nouveau script SMS doit rester **séparé** : ne pas réutiliser le même déploiement
ni les mêmes déclencheurs que le Robot Booking (voir INVENTAIRE remis en conversation).
