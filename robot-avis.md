# Robot des avis — règles de réponse et de relance

Ce document consigne les règles du robot qui répond aux avis clients et
programme les relances. Le robot lui-même est implémenté dans le backend
Google Apps Script (non versionné dans ce dépôt) ; ce fichier sert de
référence pour sa configuration.

## Demande d'avis au voyageur (relance avant la fin de la période)

Objectif : inciter le voyageur à laisser une note **s'il ne l'a pas encore
fait**. Inutile (et à éviter) de relancer quelqu'un qui a déjà noté.

- **Vérifier d'abord que le voyageur n'a pas déjà laissé sa note.**
  - S'il **a déjà noté** → ne rien envoyer (la relance ne sert à rien).
  - S'il **n'a pas noté** → envoyer la relance.
- **Timing de la relance : 2 jours avant la fin de la période d'avis.**
  - Sur Airbnb, la fenêtre est de 14 jours après le départ → relance à **J+12**
    après le check-out (soit 2 jours avant la clôture).

## Avis positifs

### Airbnb

- **Relance automatique 10 jours après réception de l'avis positif** du voyageur.
- Le message de relance **doit contenir** la phrase :

  > Nous vous avons laissé un avis 5 étoiles sur Airbnb.

  (l'objectif est d'inciter le voyageur à laisser à son tour un avis 5 étoiles).

### Booking

- **Pas de relance** pour les avis Booking.
- La phrase « Nous vous avons laissé un avis 5 étoiles sur Airbnb » ne
  s'applique pas aux avis Booking.

## Récapitulatif

**Demande d'avis (relance avant clôture de la période) :**

| Étape | Règle |
|-------|-------|
| Avant d'envoyer | Vérifier que le voyageur n'a **pas encore** noté ; s'il a noté → ne rien envoyer |
| Timing | **2 jours avant la fin** de la période (Airbnb : J+12 après le départ) |

**Relance après avis positif :**

| Plateforme | Avis positif | Relance à J+10 | Mention « avis 5 étoiles laissé sur Airbnb » |
|------------|--------------|----------------|-----------------------------------------------|
| Airbnb     | Oui          | Oui            | Oui                                           |
| Booking    | Oui          | Non            | Non                                           |
