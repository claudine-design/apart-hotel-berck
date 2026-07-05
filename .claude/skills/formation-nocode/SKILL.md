---
name: formation-nocode
description: >
  Connaissances no-code issues de la formation NOCODE FORMULA + FACTURATION
  FORMULA (Le Sous Loueur / Sébastien More, communauté Skool « Airbnb Business
  Academy »), appliquées au business de Claudine : Apart Hotel Berck, location
  courte durée de 3 appartements à Berck-sur-Mer. Utiliser ce skill dès que
  Claudine parle de no-code, d'automatiser sa gestion (réservations, ménage,
  prestataires, facturation), des outils Airtable / Make / Softr / Beds24 /
  Zoho / Pennylane / Qonto, ou demande d'appliquer la formation à son activité.
---

# Formation no-code — NOCODE FORMULA (Le Sous Loueur)

## Contexte

Claudine gère **Apart Hotel Berck** : 3 appartements en location courte durée
à Berck-sur-Mer, réservations via Airbnb/Booking, un tableau de bord maison
dans ce dépôt (`direction.html`, `prestataires.html`) branché sur Google
Apps Script / Google Sheets, et des prestataires (ménage, linge) à
coordonner. Elle a acheté **NOCODE FORMULA + FACTURATION FORMULA**
(Le Sous Loueur, Sébastien More) pour utiliser le no-code dans ce business.

**Philosophie de la formation** : une conciergerie / activité de location
courte durée peut construire elle-même, pas à pas, **son propre outil de
gestion sur mesure**, sans développeur. L'écosystème enseigné repose sur
**3 outils qui se branchent ensemble** — **Airtable** (base de données),
**Make** (automatisations) et **Softr** (interfaces) — puis on **automatise
la facturation**. La documentation et les templates sont sur un **Discord**
dédié (https://discord.gg/fV3FdE5zTh).

## Structure de la formation

L'ordre d'apprentissage révélé par le module fil rouge est :
**écosystème → Airtable → Zapier/Beds24/Make → Softr → Slack → Zoho →
Documint → Maintenance → IA/Chatbot → Extra**.

L'extraction complète (16 modules / 113 leçons) a été faite le 2026-07-05
depuis la classroom Skool `0c41df47` (« FORMATION NOCODE (15H) »). Chaque
module liste les leçons avec leur titre exact et leur lien Vimeo — le détail
complet est dans `references/extraction-recap.md`.

| # | Fichier | Sujet | Leçons | État |
|---|---------|-------|--------|------|
| 0 | `module-00-fil-rouge-ecosysteme.md` | Fil rouge : écosystème + initiation Airtable/Make/Softr | 12 | ✅ **Réel** |
| — | `module-01-comprendre-le-no-code.md` | Fond de carte : concepts et vocabulaire no-code (support de compréhension) | — | ⚙️ Générique |
| 1 | `module-01-airtable-configuration.md` | Airtable — Configuration (compte, template, tables Réservation/Ménage/Agent/Propriétaire/Logement) | 7 | ✅ **Réel** |
| 2 | `module-02-airtable-champs-formules.md` | Airtable — Champs spécifiques et formules (liens, lookups, formules) | 6 | ✅ **Réel** |
| 3 | `module-03-airtable-formulaires-boutons.md` | Airtable — Formulaires et boutons (candidatures, rapports de ménage) | 8 | ✅ **Réel** |
| 4 | `module-04-airtable-vues-filtrees.md` | Airtable — Vues filtrées (Kanban, Galerie, Calendrier, export) | 8 | ✅ **Réel** |
| 5 | `module-05-zapier-liaison-airbnb-airtable.md` | Zapier — liaison directe Airbnb → Airtable sans channel manager | 4 | ✅ **Réel** |
| 6 | `module-06-beds24-et-make.md` | Beds24 et Make (channel manager, scénarios réservation) | 9 | ✅ **Réel** (1 leçon vide) |
| 7 | `module-07-softr-application-agent.md` | Softr — Application Agent (missions, ménage, calendrier) | 13 | ✅ **Réel** |
| 8 | `module-08-softr-livret-accueil-voyageurs.md` | Softr — Livret d'accueil voyageurs | 5 | ✅ **Réel** |
| 9 | `module-09-softr-application-administrateur.md` | Softr — Application Administrateur (City Manager) | 3 | ✅ **Réel** |
| 10 | `module-10-slack.md` | Slack — notifications missions/ménage | 5 | ✅ **Réel** |
| 11 | `module-11-zoho-factures-agents.md` | Zoho — Factures Agents (facturation propriétaires/agents) | 7 | ✅ **Réel** (1 leçon = placeholder) |
| 12 | `module-12-documint-contrats-automatises.md` | Documint — Contrats automatisés (bail/concierge) | 3 | ✅ **Réel** |
| 13 | `module-13-gestion-maintenance-taches.md` | Gestion de la maintenance — tâches supplémentaires | 10 | ✅ **Réel** |
| 14 | `module-14-ia-creation-chatbot.md` | IA — Création du chatbot (réponses automatiques voyageurs) | 6 | ✅ **Réel** |
| 15 | `module-15-extra.md` | Extra (SMS, contacts Google, relances logement) | 7 | ✅ **Réel** |

⚠️ **Limites connues** (détail dans `extraction-recap.md`) : Skool n'expose
pas les transcriptions des vidéos Vimeo, seul le texte écrit de chaque page
a pu être extrait (titre, notes, liens) — le contenu pédagogique détaillé
reste dans la vidéo elle-même. La leçon 9 du module 6 et une partie du
module 11 (leçon 1) sont vides ou placeholder côté texte. La documentation
et les templates restent sur le Discord privé de la formation
(non téléchargeables depuis cet environnement).

## Comment utiliser ce skill

1. Identifier le sujet de la demande et **lire le fichier de module
   correspondant** avant de répondre. Pour le contenu réel, s'appuyer sur
   `module-00` (liens vidéo inclus) ; pour les concepts généraux, sur
   `module-01`.
2. Répondre avec la logique de la formation : partir du besoin métier
   (location courte durée), choisir l'outil no-code adapté (Airtable pour les
   données, Make pour l'automatisation, Softr pour l'interface), construire
   pas à pas, tester, puis automatiser.
3. Adapter systématiquement au cas réel de Claudine : ses 3 appartements, son
   tableau de bord existant, ses prestataires. Ne pas refaire ce qui marche
   déjà chez elle sans raison.
4. Claudine n'est pas technicienne : français simple, pas de jargon sans
   explication, étapes cliquables (« ouvre X, clique sur Y »), une chose à la
   fois. Renvoyer vers la vidéo Vimeo concernée quand elle existe, et vers le
   Discord pour la documentation/templates.
5. Si la demande porte sur un module pas encore extrait, le dire clairement
   et proposer de relancer l'export Cowork pour ce module.

## Provenance du contenu

Les vidéos sont sur Skool (accès membre, non lisible directement par Claude).
L'extraction se fait depuis le PC de Claudine via **Cowork**, qui dépose un
fichier par module dans le dossier Google Drive « Formation NOCODE » ; Claude
lit ce dossier et intègre le contenu réel ici. Ce qui n'a pas encore été
extrait n'est pas inventé : `module-01` fournit seulement des repères
généraux sur le no-code, clairement distingués du verbatim du cours.
