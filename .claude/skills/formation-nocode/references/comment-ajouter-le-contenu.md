# Comment ajouter le contenu de la formation

La formation est sur Skool (accès membre uniquement), donc Claude ne peut pas
la lire directement. Pour remplir ce skill, Claudine peut au choix :

## Option 1 — Copier-coller dans le chat (le plus simple)

1. Ouvrir la formation sur Skool, module par module.
2. Pour chaque leçon : sélectionner tout le texte de la page (Ctrl+A puis
   Ctrl+C, ou Cmd+A / Cmd+C sur Mac) et le coller dans le chat Claude, en
   précisant le nom du module.
3. Claude range le contenu dans un fichier `module-XX-titre.md` de ce dossier.

Pour les leçons en vidéo sans texte : noter les points clés à la main, ou
coller la transcription si Skool en propose une.

## Option 2 — PDF dans Google Drive

1. Sur chaque page de leçon : Imprimer → « Enregistrer au format PDF ».
2. Mettre les PDF dans un dossier Google Drive nommé **« Formation NOCODE »**.
3. Dire à Claude que le dossier est prêt : il peut lire Google Drive et
   convertira tout en fichiers de ce dossier.

## Format des fichiers de module

Un fichier par module : `module-01-introduction.md`, `module-02-….md`, etc.

```markdown
# Module XX — Titre

## Leçon 1 : Titre
- Idées clés :
- Outils no-code utilisés :
- Étapes pratiques :
- Application pour Apart Hotel Berck :
```
