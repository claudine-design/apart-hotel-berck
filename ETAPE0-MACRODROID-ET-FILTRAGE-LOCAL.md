# Étape 0 — Vérification technique MacroDroid et filtrage local

> Rapport du 23 juillet 2026, suite à la validation de Claudine.
> Principe directeur confirmé : **le téléphone est personnel — le tri se fait d'abord sur le téléphone, et seuls les SMS potentiellement professionnels (ou inconnus autorisés) sont transmis à Apps Script.** Aucun envoi automatique n'est mis en service.

---

## 1. Réponses précises aux 5 vérifications demandées

Vérifications faites sur la documentation officielle MacroDroid (wiki et forum — sources en bas de page).

| Question de Claudine | Réponse | Comment |
|---|---|---|
| Reconnaître les contacts enregistrés ? | ✅ **Oui** | Le déclencheur « SMS reçu » sait distinguer : *contact quelconque*, *non-contact* (numéro inconnu), *contacts précis choisis dans une liste*, et peut **exclure** des contacts sélectionnés. |
| Exploiter directement les libellés / groupes Google Contacts ? | ❌ **Non, pas de façon fiable** | Le déclencheur SMS ne propose pas de filtre « par groupe/libellé Google Contacts ». C'est la seule case manquante → solution de remplacement fiable ci-dessous (§2). |
| Exclure localement « Famille », « Amis » et une liste d'exclusion ? | ✅ **Oui** | Deux mécanismes cumulables : (a) l'option « exclure ces contacts » du déclencheur ; (b) des **listes locales** (variables « dictionnaire » de MacroDroid) : `EXCLUS` et `PRO_AUTORISES`. Ces listes restent sur le téléphone. |
| Exclure numéros courts, codes de connexion, SMS bancaires, messages automatiques ? | ✅ **Oui** | Filtre local sur le numéro (les expéditeurs courts type « 38xxx » ou alphanumériques type « AMAZON », « LaBanquePostale » n'ont pas un vrai numéro à 10 chiffres → détectables par motif/regex) **plus** filtre local sur le contenu (motifs « code », « ne partagez jamais », suites de 4–8 chiffres…). Ces SMS ne quittent **jamais** le téléphone. |
| Ne transmettre que le professionnel + inconnus autorisés ? | ✅ **Oui** | C'est l'architecture retenue (§2) : liste blanche locale pour les contacts pro, transmission des non-contacts après passage des filtres, et **aucune transmission de tout le reste**. |

Vérifications complémentaires utiles :

- **Détection de panne côté téléphone** : l'action « HTTP Request » de MacroDroid enregistre le **code de retour** et la **réponse** du serveur dans des variables → si Apps Script ne répond pas, le téléphone le sait immédiatement (notification + mise en file d'attente locale, voir §4).
- **Canal d'envoi (pour la phase 2, pas maintenant)** : deux options existent. Le « webhook MacroDroid » est instantané mais transite par le serveur de MacroDroid (trigger.macrodroid.com). Pour la confidentialité, on retient plutôt l'**interrogation directe** : le téléphone demande lui-même à Apps Script « y a-t-il un SMS à envoyer ? » toutes les quelques minutes, en HTTPS direct, sans intermédiaire. Décision à prendre seulement en phase 2.
- **Compatibilité téléphone** : MacroDroid fonctionne sur Android 5 et plus (tous les téléphones de moins de ~8 ans). À confirmer sur le tien par le mini-test du §5 — version gratuite suffisante pour tester, aucune autorisation d'envoi de SMS requise à ce stade.

## 2. Remplacement des libellés Google Contacts : listes locales

Puisque MacroDroid ne lit pas les libellés Google Contacts pour les SMS, le tri par catégorie se fait avec **deux listes locales sur le téléphone**, faciles à modifier :

- **`PRO_AUTORISES`** : les numéros liés à l'activité (prestataires ménage, artisans, plombier, électricien…) avec leur catégorie. Exemple : `+33612345678 → prestataire_menage`. Ces SMS sont transmis **avec leur catégorie déjà connue** — l'IA n'a même pas besoin de deviner.
- **`EXCLUS`** : famille, amis, banquier, comptable, notaire, médecins, tout contact personnel. Jamais transmis, jamais analysés. En plus de cette liste, la règle par défaut protège : **un contact connu qui n'est dans aucune liste n'est pas transmis non plus** (principe « téléphone personnel d'abord »).

Remplissage : lors de l'installation, on passera ensemble 15 minutes à classer les numéros utiles. Ensuite, la liste s'entretient en 30 secondes depuis MacroDroid. (Tes libellés Google Contacts restent utiles côté Apps Script en complément, mais ne conditionnent plus la transmission.)

## 3. Ordre de tri sur le téléphone (avant toute transmission)

```
SMS reçu
 1. Interrupteur TRANSMISSION_ACTIVE = NON ?      → STOP (rien ne part)
 2. Expéditeur court/alphanumérique (banque,
    opérateur, publicité, codes de connexion) ?   → STOP + compteur local
 3. Contenu type code de connexion / bancaire ?   → STOP + compteur local
 4. Numéro dans EXCLUS ?                          → STOP + compteur local
 5. Contact connu hors PRO_AUTORISES ?            → STOP + compteur local
 6. Numéro dans PRO_AUTORISES ?                   → transmis avec sa catégorie
 7. Numéro inconnu (non-contact) ?                → transmis (phase observation :
                                                    analyse seule, jamais de réponse auto)
```

**Ce qui est transmis (le strict minimum)** :

```json
{
  "horodatage": "2026-07-23T17:42:00+02:00",
  "numero": "+33612344321",
  "texte": "Nous arrivons à 17h",
  "contact_connu": "non",
  "categorie_locale": null,
  "id_appareil": "tel-claudine",
  "signature": "(empreinte calculée avec la clé secrète)"
}
```

Rien d'autre : pas de nom pour les inconnus, le nom/catégorie uniquement pour les contacts PRO (utile au traitement), pas de position, pas d'historique, pas d'autres SMS. Les SMS bloqués localement ne quittent jamais le téléphone : seuls des **compteurs** (« 12 SMS personnels ignorés aujourd'hui ») sont envoyés une fois par jour pour alimenter le résumé du soir.

## 4. Les 7 garde-fous demandés — tous prévus dès la phase 1

| Garde-fou | Où il vit | Comment |
|---|---|---|
| Interrupteur général | Téléphone **et** Apps Script | Tuile/widget MacroDroid `TRANSMISSION_ACTIVE` (coupe les transmissions) + cellule `REPONSES_AUTO_ACTIVEES = NON` dans la Config (coupe les réponses). Deux verrous indépendants. |
| Mode observation | Config Apps Script | `MODE = OBSERVATION` : classement + propositions, zéro envoi (mode de démarrage). |
| Mode test | Config Apps Script | `MODE = TEST` : tout le circuit tourne, la réponse est rédigée et journalisée avec la mention « aurait été envoyée », mais aucun SMS ne part. |
| Historique consultable | Google Sheet | Onglet Journal complet + journal local MacroDroid sur le téléphone. |
| Anti-doublons | Les deux côtés | Empreinte (numéro + texte + fenêtre de 10 min) vérifiée sur le téléphone et dans Apps Script. |
| Alerte « MacroDroid muet » | Apps Script | Le téléphone envoie un **signal de vie** toutes les heures (compteurs seuls). Un déclencheur Apps Script vérifie : silence > 3 h entre 8 h et 22 h → e-mail d'alerte à Claudine. |
| Alerte « Apps Script / Beds24 muet » | Téléphone + Apps Script | Côté téléphone : code de retour ≠ 200 → notification immédiate + le SMS est gardé en file locale et retransmis plus tard (aucune perte). Côté script : échec Beds24 après 3 tentatives → e-mail d'alerte + bascule automatique en « proposer seulement ». |

## 5. Mini-test de compatibilité sur ton téléphone (10 minutes, sans risque)

À faire quand tu veux — aucune autorisation d'envoi de SMS, rien ne sort du téléphone :

1. Installer **MacroDroid** depuis le Play Store (version gratuite).
2. Accepter uniquement : accès SMS (lecture) et contacts. Refuser le reste pour l'instant.
3. Créer une macro : Déclencheur « SMS reçu » (de : Non-contact) → Action « Afficher une notification » avec le texte `SMS détecté de {sms_number}`.
4. Depuis un autre téléphone (ou en demandant à quelqu'un **non enregistré** dans tes contacts), t'envoyer un SMS.
5. ✅ Si la notification apparaît : compatibilité confirmée, on peut construire. ❌ Sinon : me le dire, il existe un réglage (« détection via boîte de réception ») et un plan B (appli passerelle open source).
6. Dans les réglages MacroDroid, accepter « Ignorer l'optimisation de batterie » quand l'appli le propose (indispensable pour la fiabilité en arrière-plan).

## 6. Sauvegarde du robot Booking (préalable à tout)

Voir le guide pas à pas : [`apps-script/robot-booking/SAUVEGARDE.md`](apps-script/robot-booking/SAUVEGARDE.md). En résumé : une **copie de sécurité en un clic** dans Apps Script (« Créer une copie »), puis récupération du code via la session « FIN ROBOT MESSA BEDS24 guest response bot » pour l'archiver dans ce dépôt GitHub.

## Sources documentaires

- [Wiki MacroDroid — Déclencheur SMS reçu](https://www.macrodroidforum.com/wiki/index.php/Trigger:_SMS_Received)
- [Wiki MacroDroid — Action HTTP Request](https://www.macrodroidforum.com/wiki/index.php/Action:_HTTP_Request)
- [Wiki MacroDroid — Déclencheur Webhook (URL)](https://macrodroidforum.com/wiki/index.php/Trigger:_Webhook_(URL))
- [Wiki MacroDroid — Variables (dictionnaires)](https://www.macrodroidforum.com/wiki/index.php/Variables)
- [Wiki MacroDroid — Magic text (variables {sms_number}, etc.)](https://macrodroidforum.com/wiki/index.php/Magic_text)
- [Blog MacroDroid — Webhook trigger](https://medium.com/@macrodroid/introducing-the-webhook-trigger-a760e2ee140d)
