# Plan d'évolution — Gestion des SMS voyageurs (téléphone Android personnel)

> Document d'analyse et de proposition, préparé le 23 juillet 2026.
> **Aucune modification de code n'a été faite.** Ce document attend la validation de Claudine avant tout développement.

---

## 1. Analyse de l'existant

### 1.1 Ce qui a été retrouvé

**A. Le robot « Messages Booking » (Apps Script, en production)**

Traces observées dans Gmail (e-mails « Robots Annonces Berck ») :

- Un script Apps Script déployé en application web :
  `https://script.google.com/macros/s/AKfycbxdZ3JN…/exec`
- Un **webhook sécurisé par clé secrète** dans l'URL (`?k=<clé-uuid>`) — c'est par là que les messages Booking entrent dans le système (vraisemblablement via une Auto Action Beds24).
- Une **IA qui rédige des propositions de réponse** dans le style de Claudine (tutoiement du prénom, émojis, signature « Claudine »).
- Un **e-mail de notification** « 🤖 X proposition(s) de réponse Booking à valider » envoyé à claudine.podvin@gmail.com et princessedopale@gmail.com, avec :
  - le logement, le nom du voyageur, les dates du séjour ;
  - le message reçu ;
  - la réponse proposée ;
  - un lien « 👉 Ouvrir l'interface de validation » (page web du même script).
- Une **escalade déjà en place** : les cas délicats portent la mention « ⚠️ à traiter par Claudine » avec une explication (ex. : voyageuse à mobilité réduite sur un logement au 2ᵉ étage, paiement PayPal à vérifier).

**B. Les autres robots du même écosystème**

- « ⭐ Machine à avis » : relance d'avis avec validation par simple réponse e-mail (« OK sauf Elisabeth »).
- « ⚠️ Robot avis Booking » : lecture des avis via iframes (avec alerte quand les tokens expirent).
- « 🔎 Veille algo Airbnb/Booking » hebdomadaire.

**C. Ce dépôt GitHub (`apart-hotel-berck`)**

Il ne contient que les deux applications de planning ménage (`prestataires.html`, `direction.html`), adossées à un **autre** déploiement Apps Script (`AKfycbztItAM…`) qui sert de proxy iCal/Beds24. Le code du robot Messages Booking **n'est pas dans ce dépôt**.

### 1.2 Limite importante de cette analyse

⚠️ **Je n'ai pas pu lire le code source du script « Messages Booking »** depuis cet environnement : les projets Apps Script ne sont pas visibles via Google Drive, et le code n'est pas dans GitHub. L'architecture ci-dessus est déduite du comportement observable (e-mails, URLs).

**Précision de Claudine (23/07)** : toutes les informations sur le robot de réponse aux messages Booking se trouvent dans la session Claude « FIN ROBOT MESSA BEDS24 guest response bot ». Au moment de l'implémentation, on récupérera depuis cette session (ou depuis script.google.com) le code et les règles exactes, afin de :
1. réutiliser les briques existantes au lieu de les réécrire ;
2. garantir qu'on ne casse rien ;
3. sauvegarder ce code dans GitHub (il n'y est pas aujourd'hui — c'est un risque en soi, voir §1.5).

### 1.3 Architecture actuelle (déduite)

```
Booking → Beds24 → Auto Action (webhook + clé) → Apps Script
                                                    │
                                    IA (rédaction style Claudine)
                                                    │
                    ┌───────────────────────────────┤
                    ▼                               ▼
        E-mail de proposition            Interface web de validation
        (Claudine + Princesse d'Opale)   (même script, page /exec)
```

### 1.4 Points réutilisables (à confirmer après lecture du code)

| Brique existante | Réutilisation pour les SMS |
|---|---|
| Webhook sécurisé par clé | Même modèle pour recevoir les SMS |
| Appel à l'IA + style « Claudine » | Identique — mêmes règles de ton |
| E-mail de proposition + interface de validation | On ajoute un onglet/section « SMS » |
| Lien Beds24 (réservations, logements) | Identique — recherche par téléphone |
| Escalade « ⚠️ à traiter par Claudine » | Devient le « Niveau 5 — Alerter » |
| Mécanique « Machine à avis » (validation par réponse e-mail) | Modèle pour valider un envoi de SMS depuis un e-mail |

### 1.5 Risques identifiés

1. **Code non sauvegardé** : le robot Booking n'existe que dans Apps Script. S'il est modifié par erreur, pas de retour arrière. → Première étape du plan : le copier dans GitHub, **avant** toute évolution.
2. **Tout-en-un** : si on ajoute les SMS dans le même script sans précaution, un bug SMS peut casser le flux Booking. → Le plan prévoit un **script séparé** (voir §6).
3. **Quotas Google** : Apps Script est limité (ex. ~20 000 appels réseau/jour, ~100–1500 e-mails/jour selon le compte, exécutions de 6 min max). Largement suffisant pour des SMS, mais à surveiller dans le journal.
4. **Clé dans l'URL** : la clé `?k=…` circule dans les journaux des serveurs. Acceptable, mais pour les SMS on mettra la clé **dans le corps** de la requête + une signature.
5. **Numéros de téléphone** : Booking fournit souvent des numéros relais temporaires ; le SMS arrivera du **vrai** numéro du voyageur, qui peut ne pas être celui de la réservation → d'où l'importance du scénario « numéro non reconnu » et du protocole de vérification.

---

## 2. Comparaison des passerelles Android → Apps Script

Le besoin : intercepter les SMS **reçus sur le téléphone personnel** de Claudine, les transmettre à Apps Script, et pouvoir **envoyer** des SMS depuis ce même numéro. Aucun service cloud ne peut faire ça sans une application sur le téléphone.

| Critère | **MacroDroid** | Tasker (+plugins) | Appli SMS-gateway dédiée (ex. httpSMS, SMS Gate) | Appli Android sur mesure | Numéro cloud (Twilio/OVH) |
|---|---|---|---|---|---|
| Simplicité d'installation | ✅✅ Très simple (assistant visuel) | ⚠️ Complexe | ✅ Simple | ❌ Développement complet | ✅ mais… |
| Reçoit les SMS du numéro personnel | ✅ | ✅ | ✅ | ✅ | ❌ **Non** (autre numéro) |
| Peut envoyer des SMS depuis le téléphone | ✅ | ✅ | ✅ | ✅ | ❌ (autre numéro) |
| Sait si le numéro est dans les contacts | ✅ (nom du contact) | ✅ | ⚠️ Variable | ✅ | ❌ |
| Fonctionne en arrière-plan durablement | ✅ (réglage batterie à faire 1 fois) | ✅ | ✅ | ✅ | — |
| Appel d'un webhook HTTPS (avec POST JSON) | ✅ | ✅ | ✅ | ✅ | — |
| Déclenchement d'un envoi depuis le cloud | ✅ (webhook entrant MacroDroid) | ✅ (AutoRemote) | ✅ (API) | ✅ | — |
| Coût | ~6 € une fois (version Pro) | ~4 € + plugins | Gratuit (open source) à ~2 €/mois | Élevé (temps) | ~1–5 €/mois + numéro |
| Stabilité / maturité | ✅ Très répandu | ✅ | ⚠️ Projets plus petits | Dépend de nous | ✅ |
| Maintenance pour Claudine | ✅ Quasi nulle | ⚠️ | ✅ | ❌ | ✅ |

### Recommandation : **MacroDroid** ✅

Pourquoi :
- répond à **tous** les critères demandés (simple, stable, peu coûteux, arrière-plan, aucune manipulation quotidienne, compatible webhook Apps Script) ;
- deux macros suffisent :
  1. **Réception** : « SMS reçu » → requête HTTP POST vers Apps Script (numéro, texte, date, nom du contact s'il existe) ;
  2. **Envoi** : « Webhook MacroDroid reçu » → « Envoyer un SMS » (c'est Apps Script qui appelle ce webhook quand un envoi est autorisé) ;
- l'envoi part du **vrai numéro de Claudine**, donc le voyageur répond au même fil de discussion ;
- si le téléphone est éteint, les SMS sont traités à l'allumage (les macros se déclenchent à la réception effective).

Le numéro cloud (Twilio) est écarté car il ne voit pas les SMS adressés au numéro personnel. Tasker est écarté car plus complexe pour un gain nul ici. L'appli sur mesure est écartée (maintenance disproportionnée). Une appli gateway open source reste le **plan B** si MacroDroid décevait.

### Accès aux contacts et confidentialité : filtrage local d'abord (correction validée le 23/07)

**Principe retenu à la demande de Claudine : le téléphone est personnel — le premier tri se fait SUR le téléphone.** Les SMS de la famille, des amis, du banquier, du comptable, les codes de connexion et les messages bancaires **ne sont jamais transmis** à Apps Script ni à une IA : ils sont écartés localement par MacroDroid (listes locales `EXCLUS` / `PRO_AUTORISES`, filtres numéros courts et contenus sensibles). Seuls partent : les contacts professionnels autorisés (avec leur catégorie locale) et les numéros inconnus ayant passé les filtres. Chaque transmission contient le strict minimum (numéro, texte, horodatage, statut contact, signature).

⚠️ Vérification faite : MacroDroid ne lit **pas** les libellés Google Contacts pour filtrer les SMS → remplacés par des listes locales sur le téléphone, plus fiables et plus confidentielles.

Détail complet (ordre des règles, données transmises, garde-fous, sources) : voir [`ETAPE0-MACRODROID-ET-FILTRAGE-LOCAL.md`](ETAPE0-MACRODROID-ET-FILTRAGE-LOCAL.md).

---

## 3. Architecture cible

```
┌────────────── Téléphone Android (personnel) ──────────────┐
│  MacroDroid                                               │
│   Macro 1 : SMS reçu → POST JSON → Apps Script (webhook)  │
│   Macro 2 : Webhook reçu ← Apps Script → Envoi du SMS     │
└───────────────────────────────────────────────────────────┘
                        │  ▲
                        ▼  │ (envoi uniquement si autorisé)
┌──────────── Apps Script « SMS-Voyageurs » (NOUVEAU script) ────────────┐
│ 1. Sécurité webhook (clé secrète + signature + anti-doublon)          │
│ 2. Normalisation du numéro (06… ↔ +336…, international)               │
│ 3. Contacts : nom MacroDroid + libellés Google Contacts               │
│ 4. Beds24 : réservations liées à ce numéro (logement, dates, statut)  │
│ 5. IA : catégorie + intention + niveau de confiance (réponse JSON)    │
│ 6. Moteur de règles (feuille de config : scénarios autorisés, seuils) │
│ 7. Action : Ignorer / Classer / Proposer / Envoyer / Alerter          │
│ 8. Journal complet (Google Sheet) + file d'envoi + kill-switch        │
│ 9. Résumé quotidien 20h30 (e-mail)                                    │
└───────────────────────────────────────────────────────────────────────┘
                        │
        réutilise (en lecture) les mêmes briques que le robot Booking :
        clé API Beds24, style de rédaction, interface de validation
```

**Choix structurant : un script SÉPARÉ du robot Booking.** C'est la garantie n° 1 de ne jamais casser l'existant : le robot Booking n'est pas touché, pas redéployé, pas modifié. Les deux scripts partagent la même feuille de configuration de style et, à terme (phase 4), une interface de validation commune.

---

## 4. Structures de données (Google Sheet « SMS-Voyageurs »)

**Onglet `Journal`** — une ligne par SMS reçu :

| Colonne | Exemple |
|---|---|
| id_conversation | `SMS-2026-0723-001` |
| date_heure | 2026-07-23 17:42 |
| numero (masqué : +33 6 ** ** 43 21 dans les exports) | +33612344321 |
| message_recu | « Nous arrivons à 17 h » |
| contact_android | (vide) ou « Plombier Durand » |
| libelle_contact | prestataire / famille / … |
| resa_beds24 | #12345 — Terrasse — 23→26/07 — confirmée |
| categorie | voyageur_reconnu |
| intention | annonce_heure_arrivee |
| confiance | 92 % |
| action | envoi_auto |
| regle_appliquee | S1-heure-arrivee |
| reponse_generee | (texte) |
| envoyee | oui / non / en_attente_validation |
| erreur | (vide) |
| intervention_manuelle | (vide) |

**Onglet `Config`** — interrupteurs et seuils, modifiables sans toucher au code :

| Clé | Valeur |
|---|---|
| MODE | **OBSERVATION** (classement + propositions, zéro envoi) / TEST (réponses simulées, journalisées mais jamais envoyées) / PRODUCTION |
| REPONSES_AUTO_ACTIVEES | **NON** (kill-switch général — c'est le « bouton d'arrêt » demandé ; second interrupteur indépendant sur le téléphone : `TRANSMISSION_ACTIVE`) |
| ALERTE_SILENCE_TELEPHONE_H | 3 (e-mail d'alerte si le téléphone n'a rien transmis — même pas son signal de vie — depuis 3 h entre 8 h et 22 h) |
| SEUIL_CONFIANCE_ENVOI | 85 |
| SEUIL_CONFIANCE_PROPOSITION | 60 |
| HEURE_RESUME_QUOTIDIEN | 20:30 |
| FENETRE_ANTI_DOUBLON_MIN | 10 |
| MAX_SMS_AUTO_PAR_JOUR | 20 |
| MAX_SMS_AUTO_PAR_NUMERO_PAR_JOUR | 3 |

**Onglet `Regles`** — un scénario par ligne : identifiant, catégorie requise, intention requise, confiance minimale, action (ignorer/classer/proposer/envoyer/alerter), modèle de réponse, actif oui/non.

**Onglet `Modeles`** — les textes types (dont les deux textes fournis par Claudine pour les scénarios 1 et 2), avec variables `{prenom}`, `{heure}`, `{logement}`. **Aucun texte en dur dans le code.**

**Onglet `Conversations`** — état par numéro : dernier échange, statut (`en_attente_identification`, `identifie`, `clos`), nombre de tentatives d'identification (alerte au-delà de 3).

**Secrets** (jamais dans le Sheet ni dans le code) : clé du webhook, clé API Beds24, URL du webhook MacroDroid, clé IA → **Propriétés du script** (PropertiesService), comme aujourd'hui.

---

## 5. Catégories, confiance et niveaux d'autonomie

Conformes à la demande — rappel de la matrice de décision :

| Catégorie détectée | Action par défaut (phase 1) | Action cible (phase 2+) |
|---|---|---|
| Voyageur Beds24 reconnu (numéro = réservation, dates cohérentes) | Proposer | **Envoyer** si scénario autorisé + confiance ≥ 85 |
| Voyageur probablement reconnu (correspondance partielle) | Proposer | Proposer |
| Voyageur non reconnu (se dit voyageur, numéro inconnu de Beds24) | Proposer (texte scénario 2) | Envoyer demande d'identification, **jamais** d'info sensible |
| Prestataire / professionnel / famille / ami (contact ou libellé) | Ignorer (juste classé) | Ignorer |
| Commercial / automatique | Ignorer | Ignorer |
| Urgence, fraude, menace, plainte, remboursement, agressivité | **Alerter Claudine** | Alerter (immédiat, pas au résumé du soir) |
| Ambigu | Classer + proposer sans envoyer | idem |

Le calcul de confiance combine : numéro trouvé dans Beds24, réservation exacte, date cohérente, logement identifié, intention claire, absence de contradiction, absence de demande sensible, historique de la conversation. Toute demande touchant **codes, adresses précises, autres voyageurs** plafonne automatiquement la confiance sous le seuil d'envoi → jamais d'envoi automatique d'un code sans vérification complète (numéro + nom + logement + date + arrivée aujourd'hui), même en phase 4.

**Verrous anti-erreur** (tous actifs dès la phase 1) :
- anti-doublon : même numéro + même texte dans la fenêtre de 10 min → ignoré ;
- une seule réponse automatique par SMS ; plafonds journaliers ;
- kill-switch `REPONSES_AUTO_ACTIVEES = NON` coupe tous les envois en une cellule ;
- en cas d'erreur technique (Beds24 injoignable, IA en échec…) : nouvelle tentative jusqu'à 3 fois puis bascule automatique en « Proposer + Alerter », jamais d'envoi.

---

## 6. Plan de mise en œuvre par étapes

### Étape 0 — Sauvegarde (préalable, sans risque)
- Récupérer le code du robot Booking existant et le déposer dans ce dépôt GitHub (dossier `apps-script/robot-booking/`).
- Retour arrière : sans objet (copie en lecture seule).
- Test : le robot Booking continue de fonctionner à l'identique (aucun redéploiement).

### Étape 1 — Réception et journalisation (Phase 1 demandée)
- **Ce qui change** : création du nouveau script « SMS-Voyageurs » + Sheet ; installation de MacroDroid (macro Réception uniquement) ; classification IA ; propositions par e-mail (comme les propositions Booking actuelles). **Aucun envoi automatique.**
- **Pourquoi** : observer une à deux semaines la fiabilité de la classification sur les vrais SMS (famille, artisans, voyageurs…).
- **Risque** : quasi nul — le système ne fait que lire et écrire dans son propre journal.
- **Retour arrière** : désactiver la macro MacroDroid (un interrupteur).
- **Tests** : s'envoyer des SMS de test (numéro connu / inconnu / contact famille) et vérifier le journal + les e-mails.

### Étape 2 — Envois automatiques limités (Phase 2)
- Activation de la macro Envoi MacroDroid ; 2–3 scénarios seulement (ex. S1 heure d'arrivée, accusé de réception simple), uniquement voyageur parfaitement identifié, confiance ≥ 85.
- Retour arrière : `REPONSES_AUTO_ACTIVEES = NON`.
- Tests : chaque envoi auto est vérifié dans le résumé du soir pendant 2 semaines.

### Étape 3 — Résumé quotidien + nouveaux scénarios (Phase 3)
- E-mail de résumé à 20h30 (comptages + détail de chaque action automatique : SMS reçu, catégorie, réservation, réponse, confiance, règle, horodatage).
- Ajustement des seuils d'après les corrections manuelles.

### Étape 4 — Autonomie élargie (Phase 4)
- Gestion des urgences jour d'arrivée (protocole du scénario 3 : questions de localisation avant tout code), intégration Beds24 plus fine (écriture de notes sur la réservation), interface de validation commune Booking + SMS.

---

## 7. Autorisations Android nécessaires (MacroDroid)

À accorder une seule fois à l'installation :
- **SMS** : lecture / réception (macro 1) et envoi (macro 2) ;
- **Contacts** : lecture (pour joindre le nom du contact au SMS) ;
- **Ignorer l'optimisation de batterie** : indispensable pour l'arrière-plan fiable ;
- Accès réseau (automatique).

Rien d'autre : pas d'accès au micro, à la position, aux photos.

## 8. Coûts

| Poste | Coût |
|---|---|
| MacroDroid Pro | ≈ 6 € une seule fois |
| Apps Script, Sheets, Gmail, Google Contacts | 0 € |
| API Beds24 | inclus dans l'abonnement actuel |
| IA (même mécanisme que le robot Booking) | selon l'existant ; ordre de grandeur quelques €/mois |
| **Total** | **< 10 € de mise en route, quasi 0 €/mois** |

## 9. Points de sécurité (récapitulatif)

1. Clé secrète du webhook stockée dans les Propriétés du script, transmise dans le **corps** de la requête (pas l'URL) ; rotation possible à tout moment.
2. Signature du contenu (empreinte calculée avec la clé) → un tiers qui découvrirait l'URL ne peut pas injecter de faux SMS.
3. Numéros **masqués** dans les journaux techniques et le résumé (complets uniquement dans l'onglet Journal, accessible à Claudine seule).
4. Aucune information sensible (codes, adresses précises, noms/dates d'autres voyageurs, numéro de logement) vers un numéro non vérifié — règle codée en dur dans le moteur, **non contournable par l'IA**.
5. Les informations données par SMS (nom, date…) sont **recoupées avec Beds24** avant de débloquer quoi que ce soit.
6. Kill-switch général + plafonds journaliers + anti-doublon.
7. Le robot Booking existant n'est ni modifié ni redéployé (script séparé).

## 10. Fonctions principales prévues (nouveau script)

- `doPost(e)` — réception du webhook, contrôle clé + signature, anti-doublon (verrou LockService) ;
- `normaliserNumero(brut)` — formats FR (06/07, +33, 0033) et internationaux → E.164 ;
- `chercherContact(numero)` — nom MacroDroid + libellés Google Contacts (avec cache) ;
- `chercherReservationBeds24(numero)` — réservations actives/à venir liées au numéro ;
- `analyserMessage(sms, contexte)` — appel IA, réponse JSON : catégorie, intention, confiance, réponse proposée ;
- `appliquerRegles(analyse)` — lit l'onglet Règles, décide l'action ;
- `genererReponse(modele, variables)` — textes types de l'onglet Modèles ;
- `envoyerSms(numero, texte)` — appel du webhook MacroDroid (si kill-switch ouvert + plafonds OK) ;
- `journaliser(entree)` — écriture dans le Journal ;
- `resumeQuotidien()` — déclencheur horaire 20h30 ;
- `alerterClaudine(motif, entree)` — e-mail immédiat (et plus tard notification).

## 11. Tests prévus avant chaque mise en production

1. **Normalisation** : `0612345678`, `+33612345678`, `0033612345678`, numéro belge → même identité.
2. **Sécurité** : requête sans clé → rejetée ; mauvaise signature → rejetée ; doublon → ignoré.
3. **Catégories** : SMS depuis un contact « Famille » → ignoré ; depuis un numéro de réservation test Beds24 → voyageur reconnu ; numéro inconnu → scénario 2.
4. **Scénario 1** : « Nous arrivons à 17h » depuis le numéro d'une réservation test → réponse conforme au modèle, prise en compte de l'heure.
5. **Sensible** : « Quel est le code de la boîte à clés ? » depuis un numéro inconnu → jamais de code, demande d'identification, alerte si insistance (3 tentatives).
6. **Kill-switch** : `NON` → plus aucun envoi, tout passe en proposition.
7. **Résumé** : journée simulée de 10 SMS variés → comptages exacts dans l'e-mail du soir.
8. **Pannes** : clé Beds24 invalide temporairement → nouvelle tentative puis proposition + alerte, pas de plantage du reste.

---

## 12. Questions à valider par Claudine avant de commencer

1. **Passerelle** : d'accord pour MacroDroid (~6 €) ? (sinon : appli gateway open source en plan B)
2. **Code existant** : les détails du robot Booking sont dans la session « FIN ROBOT MESSA BEDS24 guest response bot » — au démarrage de l'implémentation, soit tu relances cette session pour me transmettre le code, soit je te guide pas à pas pour le copier depuis script.google.com.
3. **Script séparé** : d'accord pour créer un nouveau script « SMS-Voyageurs » à côté du robot Booking (recommandé), plutôt que de modifier le script existant ?
4. **Résumé du soir** : 20h30 par e-mail, ça te convient ? (heure modifiable dans la Config)
5. **Étape 1 d'abord** : on démarre en mode « observation » (aucune réponse automatique) pendant 1 à 2 semaines ?
