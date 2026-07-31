# Inventaire du robot Booking — analyse par Claude Code (24/07/2026)

> Établi à partir de l'archive fournie par Cowork (`Code.gs`, `Interface.html`, `README.md`).
> Contrôle secrets effectué avant archivage : aucun secret dans les fichiers (placeholders + Script Properties). ✅

## Architecture réelle (précisions par rapport au plan initial)

Le fonctionnement exact, maintenant confirmé par le code :

1. **Entrée des messages : API Beds24, pas Gmail.** Un déclencheur Apps Script toutes les 5 minutes (`scanCloud`) interroge `GET /v2/bookings/messages` (fenêtre 2 jours, canaux Booking + Airbnb) et repère les conversations dont le dernier message vient du voyageur.
2. **Anti-doublon** : onglet `ScanState` (messages déjà vus) + `LockService` (pas de double exécution) + mécanisme de « seed » au premier lancement.
3. **IA : API Claude (Anthropic), modèle `claude-sonnet-4-6`**, avec 3 prompts systèmes :
   - `SYS_SCAN_GEN` — génération de la proposition (style Claudine, règles strictes : ne jamais inventer, jamais de codes/IBAN/téléphone, `besoin_claudine=true` si doute) ;
   - `SYS_SCAN_URGENCE` — détection d'urgence seule (canaux en surveillance, ex. Airbnb) ;
   - `SYS_REFORMULER` — bouton 🪄 : Claudine dicte une consigne, l'IA rédige dans son style.
4. **Connaissances : onglet `KB`** du Sheet (fiches par appartement + `_commun` + `_style-claudine` + `_propmap` propertyId→nom), poussées depuis le PC. **Apprentissage** : l'onglet `Historique` fournit les 6 derniers exemples validés/rejetés par appartement, réinjectés dans le prompt.
5. **Sortie** : propositions dans l'onglet `Propositions` (23 colonnes), digest e-mail, **interface de validation** = template `Interface.html` servi par `doGet(?k=SECRET)` **et** une app statique GitHub Pages (`enquete-berck/messages-booking/`) qui parle au script via `doGet/doPost`.
6. **Envoi** : `envoyerBeds24()` **uniquement au clic de Claudine** (token écriture Beds24 séparé, rafraîchi et mis en cache ~6 h). Traduction automatique FR → langue du voyageur à l'envoi. Marquage « lu » côté Beds24 après envoi.
7. **Urgences** : e-mail + **WhatsApp via CallMeBot** (si propriétés configurées).
8. **Bonus** : création d'événements dans le calendrier « DRAP/ CHECK IN-OUT » pour les options (pack linge, animal, arrivée anticipée, départ tardif) ; nettoyage des propositions obsolètes (déjà répondues par Albert/Claudine ou remplacées).

## Briques réutilisables pour « SMS-Voyageurs » (confirmées dans le code)

| Brique | Fonction(s) | Réutilisation SMS |
|---|---|---|
| Appel Claude générique | `claudeCall_()` | Identique (classification + intention + confiance + réponse en un appel JSON) |
| Style + règles Claudine | `SYS_SCAN_GEN` + onglet KB `_style-claudine` | **Partager le même Sheet KB en lecture** — style unique pour Booking et SMS |
| Détection urgence | `SYS_SCAN_URGENCE`, `alerteUrgenceCloud_()` | Niveau 5 « Alerter » : e-mail + WhatsApp CallMeBot déjà prêts |
| Accès Beds24 | `beds24TokenEcriture()`, appels `/v2/bookings` | Recherche de réservation **par téléphone** (nouveau filtre, même mécanique de token) |
| Apprentissage | onglet `Historique` + injection d'exemples | Identique pour les SMS |
| Anti-doublon & verrous | `ScanState`, `LockService`, seed | Même patron pour le webhook SMS |
| Interface de validation | `Interface.html` + `apiList/apiValider/apiRejeter/apiReformuler` | Même squelette, adapté à l'envoi SMS |
| Sécurité webhook | `SECRET` en Script Property, `secretOk()` | Même patron + signature côté MacroDroid |

## Points d'attention pour la suite

- **Le robot Booking utilise un token Beds24 ÉCRITURE.** Le script SMS n'aura besoin que de **lecture** pour la phase observation → créer un token lecture séparé (moindre privilège).
- Le quota visé (~90 min/jour d'exécution) impose la même sobriété au script SMS (IA appelée seulement quand un SMS franchit le filtre local).
- Le nouveau script SMS reste **séparé** (projet, déploiement, déclencheurs distincts) et lit le KB **sans jamais y écrire**.
- Ne pas oublier la copie de sécurité en un clic dans l'éditeur Apps Script (voir `SAUVEGARDE.md`, étape A) si ce n'est pas déjà fait.
