# Robot des avis — règles de réponse et de relance

Ce document consigne les règles du robot qui répond aux avis clients et
programme les relances. Le robot lui-même est implémenté dans le backend
Google Apps Script (non versionné dans ce dépôt) ; ce fichier sert de
référence pour sa configuration.

## Principe de réciprocité

Chaque message de relance doit contenir une phrase qui **déclenche le principe
de réciprocité** (le voyageur se sent incité à noter à son tour). La phrase est
**adaptée à la plateforme** :

- **Airbnb** :
  > Nous vous avons laissé un avis 5 étoiles sur Airbnb.
- **Booking** :
  > Je ne peux pas vous noter, mais si j'avais à vous noter, je vous mettrais 10 sur 10.

  (sur Booking, l'hôte ne peut pas noter le voyageur — d'où cette formulation.)

## Demande d'avis (relance avant la fin de la période) — Airbnb ET Booking

Objectif : inciter le voyageur à laisser une note **s'il ne l'a pas encore
fait**. Inutile (et à éviter) de relancer quelqu'un qui a déjà noté.

- **Vérifier d'abord que le voyageur n'a pas déjà laissé sa note.**
  - S'il **a déjà noté** → ne rien envoyer (la relance ne sert à rien).
  - S'il **n'a pas noté** → envoyer la relance.
- **Timing : 2 jours avant la fin de la période d'avis** de la plateforme.
  - Sur Airbnb, la fenêtre est de 14 jours après le départ → relance à **J+12**
    après le check-out (soit 2 jours avant la clôture).
- Le message **inclut la phrase de réciprocité** de la plateforme (voir
  ci-dessus) : la formule Airbnb pour un séjour Airbnb, la formule Booking
  pour un séjour Booking.

## Relance après un avis positif (Airbnb uniquement)

- Quand un **avis positif** arrive sur **Airbnb** → relance automatique
  **10 jours après réception** de l'avis.
- Le message **doit contenir** la phrase de réciprocité Airbnb :
  > Nous vous avons laissé un avis 5 étoiles sur Airbnb.
- **Pas de relance équivalente après avis Booking.**

## Récapitulatif

| Flux | Airbnb | Booking |
|------|--------|---------|
| Relance avant clôture (si le voyageur n'a pas encore noté, 2 j avant la fin) | Oui | Oui |
| Relance après un avis positif (J+10) | Oui | Non |
| Phrase de réciprocité dans le message | « Nous vous avons laissé un avis 5 étoiles sur Airbnb » | « Je ne peux pas vous noter, mais si j'avais à vous noter, je vous mettrais 10 sur 10 » |
