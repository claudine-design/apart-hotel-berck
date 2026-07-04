# Comment ajouter le contenu exact des vidéos de la formation

> **État au 4 juillet 2026** : Cowork a exporté le **module 0 (fil rouge)**
> dans le dossier Drive « Formation NOCODE », puis semble s'être arrêté (aucun
> autre module après ~1 h). Pour récupérer la suite (Airtable, Make, Softr,
> Facturation Formula), **relancer Cowork** avec le prompt ci-dessous en lui
> précisant de reprendre à partir du module suivant et de ne pas s'arrêter au
> premier. Chaque nouveau `module-XX-*.md` déposé sera intégré ici.


La formation est sur Skool (accès membre uniquement). Depuis une session
Claude Code web, Skool est inaccessible (réseau bloqué + connexion au compte
de Claudine requise). Le contenu exact des leçons doit donc être extrait
**depuis l'ordinateur de Claudine**, comme cela avait été fait pour la
formation BEDS24.

## Option recommandée — Cowork sur le PC (comme pour BEDS24)

Dans l'application Claude de bureau (Cowork), sur le PC où Skool est
connecté, coller ce prompt :

> Ouvre ma formation no-code sur Skool (« Airbnb Business Academy »,
> https://www.skool.com/airbnb-business-academy/classroom/0c41df47).
> Parcours chaque module et chaque leçon. Pour chaque leçon, lis le texte de
> la page et la transcription de la vidéo si elle existe. Enregistre un
> fichier par module (`module-01-titre.md`, `module-02-titre.md`, …) dans un
> dossier Google Drive nommé « Formation NOCODE », avec pour chaque leçon :
> titre exact, idées clés, outils no-code cités, étapes pratiques.
> Cherche aussi sur mon PC le skill déjà créé pour la formation BEDS24
> (dossier `C:\Users\claud\AppData\Roaming\Claude\local-agent-mode-sessions\
> skills-plugin\...\skills\`) et copie son SKILL.md dans le même dossier
> Drive, pour servir de modèle.

Puis revenir dans la session Claude Code et dire : « le dossier Formation
NOCODE est prêt ». Claude lira le dossier Drive et intégrera le contenu réel
des leçons dans les fichiers `module-XX-*.md` de ce dossier, en remplaçant
le contenu générique.

## Option 2 — Copier-coller dans le chat

Ouvrir chaque leçon sur Skool, tout sélectionner (Ctrl+A, Ctrl+C) et coller
dans le chat en précisant le module. Claude range le contenu au bon endroit.

## Format des fichiers de module

```markdown
# Module XX — Titre exact

## Leçon 1 : Titre exact
- Idées clés :
- Outils no-code utilisés :
- Étapes pratiques :
- Application pour Apart Hotel Berck :
```
