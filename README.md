# Chez PAPI

Tableau de bord statique GitHub Pages + backend Google Apps Script pour le suivi des demandes traiteur.

## Déploiement Apps Script

Le dépôt GitHub est la source de vérité. Le backend se trouve dans `backend/code.gs` et se déploie avec `clasp`.

Fichiers à ne jamais committer :

- `.clasp.json`
- `.clasprc.json`

Avant le premier déploiement, configurer les secrets dans Apps Script :

1. Ouvrir le projet Apps Script.
2. Remplacer temporairement les valeurs dans `setupAuthSecrets()`.
3. Exécuter `setupAuthSecrets()` une seule fois.
4. Remettre les placeholders avant commit si le fichier a été modifié localement.

Ordre recommandé de publication :

1. Déployer d'abord le backend Apps Script.
2. Vérifier que l'URL Apps Script dans `CONFIG.SHEETS_URL` est correcte.
3. Publier le front GitHub Pages.

## Vérifications rapides

```bash
node --check app.js
node --check sw.js
```
