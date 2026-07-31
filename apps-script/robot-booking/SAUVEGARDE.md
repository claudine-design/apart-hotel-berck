# Sauvegarde du robot « Messages Booking » — guide pas à pas

> Objectif : avoir une copie de sécurité complète du robot AVANT toute évolution.
> Ce dossier accueillera le code du robot une fois récupéré. Le robot en production n'est jamais modifié.

## Étape A — Copie de sécurité en un clic (2 minutes, à faire par Claudine)

1. Ouvrir [script.google.com](https://script.google.com) avec le compte qui héberge le robot (celui qui envoie les e-mails « Robots Annonces Berck »).
2. Repérer le projet du robot de réponse aux messages Booking dans la liste.
3. L'ouvrir, puis cliquer sur les trois points « ⋮ » en haut à droite → **« Créer une copie »**.
4. Renommer la copie : `SAUVEGARDE robot Booking — 2026-07-23 — NE PAS TOUCHER`.

C'est tout : même si une erreur survient plus tard, cette copie permet de tout restaurer.
⚠️ La copie n'est **pas déployée** : elle ne recevra aucun message et n'enverra rien. C'est un simple double du code — aucun risque de doublon avec le robot en production.

## Étape B — Récupération du code pour GitHub

Claudine relance la session Claude « **FIN ROBOT MESSA BEDS24 guest response bot** » et lui demande de fournir le code complet du robot (tous les fichiers `.gs` et `.html`). Ensuite, soit cette session pousse directement les fichiers dans ce dossier, soit Claudine les colle dans une conversation avec la présente session.

Alternative sans l'autre session : dans l'éditeur Apps Script, ouvrir chaque fichier de la liste de gauche, tout sélectionner (Ctrl+A), copier, et me le coller — je me charge du rangement.

⚠️ **Important** : avant l'archivage dans GitHub (dépôt public), je retirerai toute clé ou secret éventuellement présent dans le code (clé Beds24, clé du webhook…) — les secrets restent uniquement dans les Propriétés du script.

## Étape C — Inventaire (fait par Claude à réception du code)

- liste des fichiers et fonctions du robot ;
- déclencheurs installés (horaires, webhook) ;
- propriétés/secrets utilisés (noms seulement, jamais les valeurs) ;
- briques réutilisables pour le système SMS (style de rédaction, appel IA, accès Beds24, interface de validation).
