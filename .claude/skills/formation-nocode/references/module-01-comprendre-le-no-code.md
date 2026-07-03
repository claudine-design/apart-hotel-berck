# Module 1 — Comprendre le no-code

## L'idée clé

Le no-code permet de créer des applications, des automatisations et des
outils numériques **sans écrire de code**, avec des interfaces visuelles en
glisser-déposer. Pour une activité de location courte durée, cela veut dire :
construire soi-même son outil de gestion sur mesure au lieu de payer un
logiciel qui ne correspond qu'à moitié, ou un développeur.

Un outil de conciergerie, quel qu'il soit, se décompose toujours en
**3 briques** :

1. **La base de données** : où vivent les informations (appartements,
   réservations, voyageurs, prestataires, tâches, factures).
2. **Les automatisations** : ce qui se passe tout seul quand un événement
   arrive (nouvelle réservation → créer la tâche de ménage → prévenir la
   femme de ménage).
3. **Les interfaces** : ce que chacun voit et touche (un planning pour
   Claudine, une liste de tâches pour les prestataires).

Toute demande « je voudrais que X se fasse tout seul » se traduit dans ces
3 briques. C'est le réflexe à avoir avant de choisir un outil.

## Vocabulaire à connaître (expliqué simplement)

- **Base / table / enregistrement** : l'équivalent d'un classeur, d'un
  onglet, d'une ligne dans un tableur — mais avec des liens entre tables
  (une réservation est *liée* à un appartement).
- **Automatisation / scénario** : une recette « SI ceci arrive, ALORS faire
  cela », qui s'exécute toute seule.
- **Déclencheur (trigger)** : l'événement qui lance la recette (nouvelle
  ligne, email reçu, date atteinte).
- **Action** : ce que la recette fait (envoyer un message, créer une tâche,
  générer une facture).
- **API** : la « prise électrique » d'un logiciel, qui permet à un autre
  logiciel de s'y brancher. Les outils no-code s'en servent pour vous, sans
  que vous la voyiez.
- **Webhook** : une sonnette : un logiciel « sonne » chez un autre pour dire
  « il s'est passé quelque chose, réagis ».
- **Channel manager** : le chef d'orchestre des réservations, qui
  synchronise Airbnb, Booking et le site en direct (calendriers, prix) pour
  éviter les doubles réservations. Voir module 5.

## Panorama des outils (famille par famille)

| Brique | Outils | À retenir |
|--------|--------|-----------|
| Base de données | **Airtable**, Google Sheets, Notion | Airtable = tableur + vraie base de données ; le standard de la formation |
| Automatisation | **Make** (ex-Integromat), Zapier, n8n | Make = le plus puissant et économique pour des scénarios riches |
| Interface | Airtable Interfaces, **Softr**, Glide | Transformer sa base en petite application pour l'équipe |
| Réservations | **Beds24** | Channel manager central du système (module 5) |
| Facturation | **Zoho Invoice**, **Pennylane**, **Qonto** | Facturation et compta automatisées (module 6) |

## Règles de bon sens enseignées

- **Commencer petit** : un premier outil qui règle UN problème (ex. le
  planning ménage), pas l'usine à gaz complète du premier coup.
- **Partir d'un template** puis adapter, plutôt que partir de zéro.
- **Ne pas dupliquer les données** : une information vit à UN endroit, les
  autres outils viennent la lire.
- **Tester avec de vraies données** (une vraie réservation) avant de faire
  confiance à une automatisation.
- Le no-code a un coût d'abonnement mensuel par outil : ne garder que ce
  qui fait gagner du temps réel.
