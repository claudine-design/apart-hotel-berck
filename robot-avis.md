# Robot des avis — règles de réponse et de relance

Ce document consigne les règles du robot qui répond aux avis clients et
programme les relances. Le robot lui-même est implémenté dans le backend
Google Apps Script (non versionné dans ce dépôt) ; ce fichier sert de
référence pour sa configuration.

## Avis positifs

### Airbnb

- **Relance automatique 10 jours après** la réponse à l'avis positif.
- Le message de relance **doit contenir** la phrase :

  > Nous vous avons laissé un avis 5 étoiles sur Airbnb.

  (l'objectif est d'inciter le voyageur à laisser à son tour un avis 5 étoiles).

### Booking

- **Pas de relance** pour les avis Booking.
- La phrase « Nous vous avons laissé un avis 5 étoiles sur Airbnb » ne
  s'applique pas aux avis Booking.

## Récapitulatif

| Plateforme | Avis positif | Relance à J+10 | Mention « avis 5 étoiles laissé sur Airbnb » |
|------------|--------------|----------------|-----------------------------------------------|
| Airbnb     | Oui          | Oui            | Oui                                           |
| Booking    | Oui          | Non            | Non                                           |
