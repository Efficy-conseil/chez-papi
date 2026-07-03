# Consignes du projet Chez Papi

## Sources de vérité

- Lire `docs/product-contract.md` avant toute modification fonctionnelle.
- Consulter `docs/frontend-functional-spec.md` pour le frontend.
- Consulter `docs/make-regression-matrix.md` avant toute modification des blueprints Make.
- Maintenir la documentation lorsque le comportement, le déploiement ou l'organisation change.

## Arborescence

- `chez-papi/` contient uniquement le frontend publié par GitHub Pages et ses prototypes.
- `apps-script/` contient le backend Google Apps Script.
- `make/` contient les blueprints Make importables.
- `gmail_filters/` contient les filtres Gmail importables.
- `docs/` contient la documentation fonctionnelle et opérationnelle.
- `scripts/` contient les contrôles et outils de déploiement.
- `skills/` contient les compétences opérationnelles propres au projet.
- Ne pas déplacer un fichier sans mettre à jour toutes ses références.

## Règles de modification

- Préserver les comportements existants sauf demande explicite contraire.
- Rechercher la cause d'un incident avant de modifier le code.
- Préférer une correction minimale, vérifiable et réversible.
- Ne jamais supprimer ou corriger une donnée de production sans confirmation explicite.
- Ne pas écraser les changements locaux ou les fichiers non suivis appartenant à l'utilisateur.
- `TODO.md` est un bloc-notes utilisateur simple : ne pas le restructurer ni traiter une ligne sans demande explicite.

## Vérifications

- Exécuter `npm run check` après toute modification du code, du backend ou des blueprints.
- Exécuter `git diff --check` avant chaque commit.
- Vérifier les fichiers JSON ou XML modifiés avec un parseur adapté.
- Pour un incident corrigé, ajouter si possible un contrôle automatique ou un cas à la matrice de non-régression.

## Déploiements

- Frontend : un push sur `main` publie automatiquement `chez-papi/` avec GitHub Actions.
- Backend : après toute modification validée de `apps-script/`, utiliser automatiquement la compétence `skills/deploy-chez-papi-backend/SKILL.md` et exécuter `npm run deploy:backend -- "Description"` dans la même intervention, sauf demande explicite de ne pas déployer.
- Le redéploiement backend doit conserver l'identifiant et l'URL de la Web App existante. Ne jamais annoncer le backend comme actif sans confirmation de la version déployée.
- Make : l'import, le test et l'activation des blueprints restent manuels.
- Gmail : l'import ajoute des filtres mais ne supprime pas les anciens.
- Ne jamais annoncer qu'un changement Make ou Gmail est actif tant que l'import manuel n'a pas été confirmé.

## Git

- Ne versionner que les fichiers liés à la demande en cours.
- Utiliser des commits ciblés avec un message décrivant le résultat.
- Ne pas inclure `TODO.md` dans un commit sauf demande explicite.
- Après un push, indiquer le commit et les éventuelles étapes manuelles restantes.
