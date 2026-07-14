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

### Comment savoir si le voyageur a noté (détection)

- **Recouper toutes les notes reçues** sur la plateforme et **rattacher chaque
  note à son voyageur** (par réservation : nom du voyageur + dates de séjour).
  Cela vaut pour Airbnb **et** pour Booking.
- **Règle : si, 10 jours après le départ, aucune note de ce voyageur n'est
  visible → il n'a pas noté.** (Pareil sur Airbnb et sur Booking.)
- Ceux dont une note est déjà rattachée → **ne rien envoyer**.

### Qui relancer

- Le voyageur qui **n'a pas mis de note** à J+10 **et** dont le séjour s'est
  bien passé (voyageur enchanté : échanges positifs, aucun incident ni
  réclamation pendant le séjour).
- Un voyageur mécontent ou dont le séjour a posé problème → **ne pas relancer**.

### Quand et comment relancer

- **Timing : 2 jours avant la fin de la période d'avis** de la plateforme.
  - Sur Airbnb, la fenêtre est de 14 jours après le départ → détection à
    **J+10**, relance à **J+12** après le check-out (2 jours avant la clôture).
  - Sur Booking : même principe — détection à J+10, relance 2 jours avant la
    clôture de la fenêtre d'avis.
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
| Détection « a noté / n'a pas noté » (recouper les notes reçues par voyageur ; pas de note visible à J+10 → n'a pas noté) | Oui | Oui |
| Relance avant clôture (si pas de note à J+10 **et** séjour enchanté, 2 j avant la fin) | Oui | Oui |
| Relance après un avis positif (J+10) | Oui | Non |
| Phrase de réciprocité dans le message | « Nous vous avons laissé un avis 5 étoiles sur Airbnb » | « Je ne peux pas vous noter, mais si j'avais à vous noter, je vous mettrais 10 sur 10 » |
